using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Audit;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Enrichment;
using Petshop.Api.Services.Images;

namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Orquestrador do pipeline de enriquecimento de catálogo.
/// Chamado pelos jobs Hangfire — nunca diretamente em request HTTP.
///
/// Pipeline por produto:
///   1. Normalização de nome → ProductNameSuggestion
///   2. Matching de imagem   → ProductImageCandidate  (se EnableImageMatching = true)
///   3. Auto-apply de imagem se score >= threshold e produto sem imagem existente
///   4. Auto-apply de nome   se score >= threshold (padrão 1.0 = idêntico, i.e. nunca auto-aplica)
///   5. Atualiza stats do EnrichmentBatch em tempo real
/// </summary>
public sealed class CatalogEnrichmentOrchestrator
{
    private readonly AppDbContext _db;
    private readonly ProductNormalizationService _normalizer;
    private readonly ProductImageMatchingService _imageMatcher;
    private readonly EnrichmentScoringService _scorer;
    private readonly IImageStorageProvider _imageStorage;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<CatalogEnrichmentOrchestrator> _logger;

    public CatalogEnrichmentOrchestrator(
        AppDbContext db,
        ProductNormalizationService normalizer,
        ProductImageMatchingService imageMatcher,
        EnrichmentScoringService scorer,
        IImageStorageProvider imageStorage,
        IHttpClientFactory httpFactory,
        ILogger<CatalogEnrichmentOrchestrator> logger)
    {
        _db           = db;
        _normalizer   = normalizer;
        _imageMatcher = imageMatcher;
        _scorer       = scorer;
        _imageStorage = imageStorage;
        _httpFactory  = httpFactory;
        _logger       = logger;
    }

    // ── Ponto de entrada para o job de normalização ───────────────────────────

    public async Task RunNormalizationAsync(Guid batchId, CancellationToken ct)
    {
        var batch = await LoadBatchAsync(batchId, ct);
        if (batch is null) return;

        var config = await GetOrCreateConfigAsync(batch.CompanyId, ct);
        if (!config.EnableNameNormalization)
        {
            _logger.LogInformation("Normalização desabilitada para empresa {CompanyId}", batch.CompanyId);
            await FinishBatchAsync(batch, ct);
            return;
        }

        batch.Status     = EnrichmentBatchStatus.Running;
        batch.StartedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Iniciando normalização do lote {BatchId} ({Total} produtos)", batchId, batch.TotalQueued);

        try
        {
            await ProcessNormalizationBatchAsync(batch, config, ct);
            await FinishBatchAsync(batch, ct);
        }
        catch (Exception ex)
        {
            batch.Status       = EnrichmentBatchStatus.Failed;
            batch.ErrorMessage = ex.Message;
            batch.FinishedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(CancellationToken.None);
            _logger.LogError(ex, "Lote de normalização {BatchId} falhou", batchId);
        }
    }

    // ── Ponto de entrada para o job de matching de imagem ─────────────────────

    public async Task RunImageMatchingAsync(Guid batchId, CancellationToken ct)
    {
        var batch = await LoadBatchAsync(batchId, ct);
        if (batch is null) return;

        var config = await GetOrCreateConfigAsync(batch.CompanyId, ct);
        if (!config.EnableImageMatching)
        {
            _logger.LogInformation("Matching de imagem desabilitado para empresa {CompanyId}", batch.CompanyId);
            return;
        }

        _logger.LogInformation("Iniciando matching de imagem do lote {BatchId}", batchId);

        try
        {
            await ProcessImageMatchingBatchAsync(batch, config, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Matching de imagem do lote {BatchId} falhou", batchId);
        }
    }

    // ── Normalização ──────────────────────────────────────────────────────────

    private async Task ProcessNormalizationBatchAsync(
        EnrichmentBatch batch,
        EnrichmentConfig config,
        CancellationToken ct)
    {
        var pageSize = config.BatchSize;
        var page     = 0;

        while (true)
        {
            if (ct.IsCancellationRequested) break;

            var results = await _db.ProductEnrichmentResults
                .Where(r => r.BatchId == batch.Id && r.Status == EnrichmentResultStatus.Queued)
                .Include(r => r.Product)
                .OrderBy(r => r.Id)
                .Skip(page * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

            if (results.Count == 0) break;

            foreach (var result in results)
            {
                if (ct.IsCancellationRequested) break;
                await ProcessNormalizationItemAsync(result, batch, config, ct);
            }

            // Avançar para próxima página apenas se não usou paginação offset
            // (itens processados mudam status, então offset não é ideal — usamos Take/skip de Queued)
            if (results.Count < pageSize) break;
        }
    }

    private async Task ProcessNormalizationItemAsync(
        ProductEnrichmentResult result,
        EnrichmentBatch batch,
        EnrichmentConfig config,
        CancellationToken ct)
    {
        result.Status = EnrichmentResultStatus.Processing;
        await _db.SaveChangesAsync(ct);

        try
        {
            var product = result.Product;

            // Normalizar nome
            var normResult = _normalizer.Normalize(product.Name);
            result.NameProcessed = true;

            if (normResult.HasChanges)
            {
                var suggestion = new ProductNameSuggestion
                {
                    CompanyId            = batch.CompanyId,
                    ProductId            = product.Id,
                    BatchId              = batch.Id,
                    OriginalName         = normResult.OriginalName,
                    SuggestedName        = normResult.SuggestedName,
                    NormalizationStepsJson = normResult.StepsJson,
                    ConfidenceScore      = normResult.ConfidenceScore,
                    Source               = NameSuggestionSource.DeterministicRules,
                    Status               = NameSuggestionStatus.Pending
                };

                // Auto-apply apenas se score >= threshold (padrão 1.0 = nunca, comportamento conservador)
                if (normResult.ConfidenceScore >= config.AutoApplyNameThreshold)
                {
                    ApplyNameSuggestion(product, suggestion);
                    suggestion.Status = NameSuggestionStatus.AutoApplied;
                    batch.NamesNormalized++;
                }
                else
                {
                    batch.PendingReview++;
                }

                _db.ProductNameSuggestions.Add(suggestion);
                await _db.SaveChangesAsync(ct);
            }

            result.Status       = EnrichmentResultStatus.Done;
            result.ProcessedAtUtc = DateTime.UtcNow;
            batch.Processed++;

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            result.Status       = EnrichmentResultStatus.Failed;
            result.FailureReason = ex.Message[..Math.Min(ex.Message.Length, 500)];
            result.ProcessedAtUtc = DateTime.UtcNow;
            batch.FailedItems++;
            await _db.SaveChangesAsync(CancellationToken.None);
            _logger.LogWarning(ex, "Falha ao normalizar produto {ProductId}", result.ProductId);
        }
    }

    // ── Matching de imagem ────────────────────────────────────────────────────

    private async Task ProcessImageMatchingBatchAsync(
        EnrichmentBatch batch,
        EnrichmentConfig config,
        CancellationToken ct)
    {
        var pageSize = config.BatchSize;

        while (true)
        {
            if (ct.IsCancellationRequested) break;

            // Busca itens Done (normalização concluída) que ainda não tiveram imagem processada
            var results = await _db.ProductEnrichmentResults
                .Where(r => r.BatchId == batch.Id
                         && r.Status  == EnrichmentResultStatus.Done
                         && !r.ImageProcessed)
                .Include(r => r.Product)
                    .ThenInclude(p => p.Images)
                .OrderBy(r => r.Id)
                .Take(pageSize)
                .ToListAsync(ct);

            if (results.Count == 0) break;

            foreach (var result in results)
            {
                if (ct.IsCancellationRequested) break;
                await ProcessImageMatchingItemAsync(result, batch, config, ct);

                // Delay entre itens para respeitar rate limit da API externa
                if (config.DelayBetweenItemsMs > 0)
                    await Task.Delay(config.DelayBetweenItemsMs, ct);
            }

            if (results.Count < pageSize) break;
        }
    }

    private async Task ProcessImageMatchingItemAsync(
        ProductEnrichmentResult result,
        EnrichmentBatch batch,
        EnrichmentConfig config,
        CancellationToken ct)
    {
        var product = result.Product;
        var hasExistingImage = product.Images.Any(i => i.IsPrimary) ||
                               product.Images.Count > 0;

        var input = new EnrichmentProductInput(
            ProductId:    product.Id,
            CompanyId:    batch.CompanyId,
            Name:         product.Name,
            Barcode:      product.Barcode,
            Brand:        null, // Brand navigation not loaded here — OK para matching básico
            CategoryName: null);

        var candidates = await _imageMatcher.FindCandidatesAsync(input, ct);

        var decision = _scorer.Decide(
            input, candidates,
            config.AutoApplyImageThreshold,
            config.ReviewImageThreshold,
            alreadyHasApprovedImage: hasExistingImage);

        result.ImageProcessed = true;

        if (decision.Decision == ImageDecisionType.None)
        {
            // Produto já tem imagem — não fazer nada
        }
        else if (decision.Candidate is not null)
        {
            var candidate = new ProductImageCandidate
            {
                CompanyId        = batch.CompanyId,
                ProductId        = product.Id,
                BatchId          = batch.Id,
                SearchQuery      = decision.Candidate.SearchQuery,
                CandidateUrl     = decision.Candidate.ImageUrl,
                Source           = decision.Candidate.Source,
                ConfidenceScore  = decision.Candidate.ConfidenceScore,
                ScoreBreakdownJson = decision.Candidate.ScoreBreakdownJson,
                CandidateName    = decision.Candidate.CandidateName,
                CandidateBrand   = decision.Candidate.CandidateBrand,
                CandidateBarcode = decision.Candidate.CandidateBarcode,
                AttemptedAtUtc   = DateTime.UtcNow,
                Status           = decision.Decision switch
                {
                    ImageDecisionType.AutoApply    => ImageCandidateStatus.Pending, // será Approved após download
                    ImageDecisionType.PendingReview => ImageCandidateStatus.Pending,
                    _                              => ImageCandidateStatus.Rejected
                }
            };

            if (decision.Decision == ImageDecisionType.AutoApply && !hasExistingImage)
            {
                var localUrl = await TryDownloadImageAsync(decision.Candidate.ImageUrl, ct);
                if (localUrl is not null)
                {
                    await ApplyImageToProductAsync(product, localUrl, candidate, ct);
                    candidate.LocalUrl = localUrl;
                    candidate.Status   = ImageCandidateStatus.AutoApplied;
                    batch.ImagesApplied++;
                }
                else
                {
                    candidate.Status = ImageCandidateStatus.Failed;
                    batch.FailedItems++;
                }
            }
            else if (decision.Decision == ImageDecisionType.PendingReview)
            {
                batch.PendingReview++;
            }

            _db.ProductImageCandidates.Add(candidate);
        }

        await _db.SaveChangesAsync(ct);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ApplyNameSuggestion(
        Petshop.Api.Models.Product product,
        ProductNameSuggestion suggestion)
    {
        var oldName = product.Name;
        product.Name       = suggestion.SuggestedName;
        product.UpdatedAtUtc = DateTime.UtcNow;

        _db.ProductChangeLogs.Add(new ProductChangeLog
        {
            CompanyId        = product.CompanyId,
            ProductId        = product.Id,
            Source           = ChangeSource.Admin,
            FieldName        = "Name",
            OldValue         = oldName,
            NewValue         = suggestion.SuggestedName,
            ChangedAtUtc     = DateTime.UtcNow,
            ChangedByUserId  = "enrichment-auto"
        });
    }

    private async Task ApplyImageToProductAsync(
        Petshop.Api.Models.Product product,
        string localUrl,
        ProductImageCandidate candidate,
        CancellationToken ct)
    {
        // Verificação de segurança dupla: nunca sobrescrever imagem existente
        var alreadyHasImage = await _db.ProductImages
            .AnyAsync(i => i.ProductId == product.Id, ct);
        if (alreadyHasImage) return;

        _db.ProductImages.Add(new ProductImage
        {
            ProductId       = product.Id,
            Url             = localUrl,
            StorageProvider = _imageStorage.ProviderName,
            IsPrimary       = true,
            SortOrder       = 0
        });

        _db.ProductChangeLogs.Add(new ProductChangeLog
        {
            CompanyId       = product.CompanyId,
            ProductId       = product.Id,
            Source          = ChangeSource.Admin,
            FieldName       = "Image",
            OldValue        = null,
            NewValue        = localUrl,
            ChangedAtUtc    = DateTime.UtcNow,
            ChangedByUserId = "enrichment-auto"
        });
    }

    private async Task<string?> TryDownloadImageAsync(string url, CancellationToken ct)
    {
        try
        {
            using var http   = _httpFactory.CreateClient();
            http.Timeout     = TimeSpan.FromSeconds(15);
            var response     = await http.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var ext         = contentType.Contains("png") ? ".png" : ".jpg";
            var fileName    = $"{Guid.NewGuid()}{ext}";

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            return await _imageStorage.SaveAsync(stream, fileName, contentType, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao baixar imagem {Url}", url);
            return null;
        }
    }

    private async Task<EnrichmentBatch?> LoadBatchAsync(Guid batchId, CancellationToken ct)
    {
        var batch = await _db.EnrichmentBatches
            .FirstOrDefaultAsync(b => b.Id == batchId, ct);

        if (batch is null)
            _logger.LogWarning("Lote de enriquecimento {BatchId} não encontrado", batchId);

        return batch;
    }

    private async Task FinishBatchAsync(EnrichmentBatch batch, CancellationToken ct)
    {
        batch.Status       = EnrichmentBatchStatus.Done;
        batch.FinishedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation(
            "Lote {BatchId} concluído: {Processed} processados, {Names} nomes, {Images} imagens, {Pending} pendentes, {Failed} falhas",
            batch.Id, batch.Processed, batch.NamesNormalized, batch.ImagesApplied, batch.PendingReview, batch.FailedItems);
    }

    private async Task<EnrichmentConfig> GetOrCreateConfigAsync(Guid companyId, CancellationToken ct)
    {
        var config = await _db.EnrichmentConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, ct);

        if (config is not null) return config;

        config = new EnrichmentConfig { CompanyId = companyId };
        _db.EnrichmentConfigs.Add(config);
        await _db.SaveChangesAsync(ct);
        return config;
    }
}
