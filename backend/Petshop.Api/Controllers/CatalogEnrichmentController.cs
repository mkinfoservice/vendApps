using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Enrichment;
using Petshop.Api.Data;
using Petshop.Api.Entities.Enrichment;
using Petshop.Api.Services.Enrichment;
using Petshop.Api.Services.Enrichment.Jobs;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoints de administração do módulo de enriquecimento de catálogo.
/// Todos os endpoints são restritos a admin/gerente e filtrados por CompanyId.
/// O processamento pesado NUNCA ocorre inline — sempre via Hangfire.
/// </summary>
[ApiController]
[Route("admin/enrichment")]
[Authorize(Roles = "admin,gerente")]
public class CatalogEnrichmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EnrichmentBatchService _batchService;
    private readonly IBackgroundJobClient _jobs;
    private readonly GoogleImageSearchMatcher _googleMatcher;
    private readonly ILogger<CatalogEnrichmentController> _logger;

    public CatalogEnrichmentController(
        AppDbContext db,
        EnrichmentBatchService batchService,
        IBackgroundJobClient jobs,
        GoogleImageSearchMatcher googleMatcher,
        ILogger<CatalogEnrichmentController> logger)
    {
        _db            = db;
        _batchService  = batchService;
        _jobs          = jobs;
        _googleMatcher = googleMatcher;
        _logger        = logger;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);
    private string UserId  => User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

    // ═══════════════════════════════════════════════════════════════
    // BATCHES
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Cria um novo lote de enriquecimento e enfileira o job de normalização.
    /// Retorna imediatamente com o batchId para polling de status.
    /// </summary>
    [HttpPost("batches")]
    public async Task<IActionResult> CreateBatch(
        [FromBody] CreateEnrichmentBatchRequest req,
        CancellationToken ct)
    {
        var scope = req.Scope?.ToLowerInvariant() switch
        {
            "without-image"     => EnrichmentScope.WithoutImage,
            "recently-imported" => EnrichmentScope.RecentlyImported,
            "by-category"       => EnrichmentScope.ByCategory,
            _                   => EnrichmentScope.All
        };

        if (scope == EnrichmentScope.ByCategory && req.CategoryId is null)
            return BadRequest("CategoryId é obrigatório para o escopo by-category.");

        var batch = await _batchService.CreateBatchAsync(
            companyId:   CompanyId,
            trigger:     EnrichmentTrigger.Manual,
            scope:       scope,
            categoryId:  req.CategoryId,
            recentHours: req.RecentHours,
            syncJobId:   null,
            ct:          ct);

        if (batch.TotalQueued > 0)
        {
            var normalizeJobId = _jobs.Enqueue<EnrichNormalizeProductsJob>(
                j => j.ExecuteAsync(batch.Id, CancellationToken.None));

            // Matching de imagem roda após normalização (ContinueJobWith garante ordem)
            if (req.IncludeImages)
            {
                _jobs.ContinueJobWith<EnrichMatchImagesJob>(
                    normalizeJobId,
                    j => j.ExecuteAsync(batch.Id, CancellationToken.None));
            }
        }

        return Ok(MapBatch(batch));
    }

    /// <summary>Lista lotes de enriquecimento da empresa.</summary>
    [HttpGet("batches")]
    public async Task<IActionResult> ListBatches(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var (total, items) = await _batchService.ListBatchesAsync(CompanyId, page, pageSize, ct);
        return Ok(new EnrichmentBatchListResponse(page, pageSize, total, items.Select(MapBatch).ToList()));
    }

    /// <summary>Retorna detalhes de um lote específico.</summary>
    [HttpGet("batches/{batchId:guid}")]
    public async Task<IActionResult> GetBatch(Guid batchId, CancellationToken ct)
    {
        var batch = await _batchService.GetBatchAsync(CompanyId, batchId, ct);
        if (batch is null) return NotFound();
        return Ok(MapBatch(batch));
    }

    // ═══════════════════════════════════════════════════════════════
    // FILA DE REVISÃO — NOMES
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Retorna sugestões de nome pendentes de revisão, com filtros.
    /// </summary>
    [HttpGet("review/names")]
    public async Task<IActionResult> ListNameSuggestions(
        [FromQuery] string  status   = "Pending",
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 50,
        [FromQuery] Guid?   batchId  = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        var q = _db.ProductNameSuggestions
            .AsNoTracking()
            .Include(s => s.Product)
            .Where(s => s.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(s => s.Status.ToString() == status);

        if (batchId.HasValue)
            q = q.Where(s => s.BatchId == batchId.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var mapped = items.Select(s => new NameSuggestionResponse(
            s.Id, s.ProductId, s.Product.Name,
            s.OriginalName, s.SuggestedName,
            s.ConfidenceScore, s.Source.ToString(), s.Status.ToString(),
            s.CreatedAtUtc)).ToList();

        return Ok(new NameSuggestionListResponse(page, pageSize, total, mapped));
    }

    /// <summary>Aprova uma sugestão de nome — aplica ao produto.</summary>
    [HttpPost("review/names/{suggestionId:guid}/approve")]
    public async Task<IActionResult> ApproveName(Guid suggestionId, CancellationToken ct)
    {
        var suggestion = await _db.ProductNameSuggestions
            .Include(s => s.Product)
            .FirstOrDefaultAsync(s => s.Id == suggestionId && s.CompanyId == CompanyId, ct);

        if (suggestion is null) return NotFound();
        if (suggestion.Status != NameSuggestionStatus.Pending)
            return BadRequest("Sugestão não está pendente.");

        var product = suggestion.Product;
        var oldName = product.Name;

        product.Name       = suggestion.SuggestedName;
        product.UpdatedAtUtc = DateTime.UtcNow;

        suggestion.Status           = NameSuggestionStatus.Approved;
        suggestion.ReviewedByUserId = UserId;
        suggestion.ReviewedAtUtc    = DateTime.UtcNow;

        _db.ProductChangeLogs.Add(new Entities.Audit.ProductChangeLog
        {
            CompanyId       = CompanyId,
            ProductId       = product.Id,
            Source          = Entities.Audit.ChangeSource.Admin,
            FieldName       = "Name",
            OldValue        = oldName,
            NewValue        = suggestion.SuggestedName,
            ChangedAtUtc    = DateTime.UtcNow,
            ChangedByUserId = UserId
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Nome aprovado e aplicado ao produto." });
    }

    /// <summary>Rejeita uma sugestão de nome — produto não é alterado.</summary>
    [HttpPost("review/names/{suggestionId:guid}/reject")]
    public async Task<IActionResult> RejectName(Guid suggestionId, CancellationToken ct)
    {
        var suggestion = await _db.ProductNameSuggestions
            .FirstOrDefaultAsync(s => s.Id == suggestionId && s.CompanyId == CompanyId, ct);

        if (suggestion is null) return NotFound();
        if (suggestion.Status != NameSuggestionStatus.Pending)
            return BadRequest("Sugestão não está pendente.");

        suggestion.Status           = NameSuggestionStatus.Rejected;
        suggestion.ReviewedByUserId = UserId;
        suggestion.ReviewedAtUtc    = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Sugestão rejeitada." });
    }

    /// <summary>Aprova TODAS as sugestões de nome pendentes da empresa.</summary>
    [HttpPost("review/names/approve-all")]
    public async Task<IActionResult> ApproveAllNames(CancellationToken ct)
    {
        const int batchSize = 200;
        int applied = 0;

        while (true)
        {
            var suggestions = await _db.ProductNameSuggestions
                .Include(s => s.Product)
                .Where(s => s.CompanyId == CompanyId && s.Status == NameSuggestionStatus.Pending)
                .Take(batchSize)
                .ToListAsync(ct);

            if (suggestions.Count == 0) break;

            foreach (var s in suggestions)
            {
                var oldName = s.Product.Name;
                s.Product.Name       = s.SuggestedName;
                s.Product.UpdatedAtUtc = DateTime.UtcNow;
                s.Status             = NameSuggestionStatus.Approved;
                s.ReviewedByUserId   = UserId;
                s.ReviewedAtUtc      = DateTime.UtcNow;

                _db.ProductChangeLogs.Add(new Entities.Audit.ProductChangeLog
                {
                    CompanyId       = CompanyId,
                    ProductId       = s.ProductId,
                    Source          = Entities.Audit.ChangeSource.Admin,
                    FieldName       = "Name",
                    OldValue        = oldName,
                    NewValue        = s.SuggestedName,
                    ChangedAtUtc    = DateTime.UtcNow,
                    ChangedByUserId = UserId
                });
                applied++;
            }

            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { applied, message = $"{applied} nome(s) aprovado(s) e aplicado(s)." });
    }

    /// <summary>Aprova múltiplas sugestões de nome em lote.</summary>
    [HttpPost("review/names/bulk-approve")]
    public async Task<IActionResult> BulkApproveNames(
        [FromBody] BulkApproveNamesRequest req,
        CancellationToken ct)
    {
        if (req.SuggestionIds.Count == 0) return BadRequest("Lista vazia.");
        if (req.SuggestionIds.Count > 500) return BadRequest("Máximo de 500 itens por lote.");

        var suggestions = await _db.ProductNameSuggestions
            .Include(s => s.Product)
            .Where(s => req.SuggestionIds.Contains(s.Id)
                     && s.CompanyId == CompanyId
                     && s.Status    == NameSuggestionStatus.Pending)
            .ToListAsync(ct);

        int applied = 0;
        foreach (var s in suggestions)
        {
            var oldName = s.Product.Name;
            s.Product.Name       = s.SuggestedName;
            s.Product.UpdatedAtUtc = DateTime.UtcNow;
            s.Status             = NameSuggestionStatus.Approved;
            s.ReviewedByUserId   = UserId;
            s.ReviewedAtUtc      = DateTime.UtcNow;

            _db.ProductChangeLogs.Add(new Entities.Audit.ProductChangeLog
            {
                CompanyId       = CompanyId,
                ProductId       = s.ProductId,
                Source          = Entities.Audit.ChangeSource.Admin,
                FieldName       = "Name",
                OldValue        = oldName,
                NewValue        = s.SuggestedName,
                ChangedAtUtc    = DateTime.UtcNow,
                ChangedByUserId = UserId
            });
            applied++;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { applied, message = $"{applied} nome(s) aprovado(s) e aplicado(s)." });
    }

    // ═══════════════════════════════════════════════════════════════
    // FILA DE REVISÃO — IMAGENS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Retorna candidatas de imagem pendentes de revisão.
    /// </summary>
    [HttpGet("review/images")]
    public async Task<IActionResult> ListImageCandidates(
        [FromQuery] string  status   = "Pending",
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 50,
        [FromQuery] Guid?   batchId  = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        var q = _db.ProductImageCandidates
            .AsNoTracking()
            .Include(c => c.Product)
            .Where(c => c.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(c => c.Status.ToString() == status);

        if (batchId.HasValue)
            q = q.Where(c => c.BatchId == batchId.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(c => c.ConfidenceScore)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var mapped = items.Select(c => new ImageCandidateResponse(
            c.Id, c.ProductId, c.Product.Name,
            c.CandidateUrl, c.CandidateName, c.CandidateBrand, c.CandidateBarcode,
            c.Source, c.ConfidenceScore, c.ScoreBreakdownJson,
            c.Status.ToString(), c.CreatedAtUtc)).ToList();

        return Ok(new ImageCandidateListResponse(page, pageSize, total, mapped));
    }

    /// <summary>
    /// Aprova uma candidata de imagem — baixa e salva localmente, aplica ao produto.
    /// Só aplica se o produto ainda não tiver imagem.
    /// </summary>
    [HttpPost("review/images/{candidateId:guid}/approve")]
    public async Task<IActionResult> ApproveImage(
        Guid candidateId,
        [FromServices] Services.Images.IImageStorageProvider imageStorage,
        [FromServices] IHttpClientFactory httpFactory,
        CancellationToken ct)
    {
        var candidate = await _db.ProductImageCandidates
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == candidateId && c.CompanyId == CompanyId, ct);

        if (candidate is null) return NotFound();
        if (candidate.Status != ImageCandidateStatus.Pending)
            return BadRequest("Candidata não está pendente.");
        if (string.IsNullOrWhiteSpace(candidate.CandidateUrl))
            return BadRequest("Candidata sem URL de imagem.");

        // Verificação de segurança: não sobrescrever imagem existente
        var hasImage = await _db.ProductImages.AnyAsync(i => i.ProductId == candidate.ProductId, ct);
        if (hasImage)
            return Conflict("Produto já possui imagem. Remova a existente antes de aprovar uma nova.");

        // Download e armazenamento local
        try
        {
            using var http    = httpFactory.CreateClient();
            http.Timeout      = TimeSpan.FromSeconds(20);
            var response      = await http.GetAsync(candidate.CandidateUrl, ct);
            response.EnsureSuccessStatusCode();

            var contentType   = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var ext           = contentType.Contains("png") ? ".png" : ".jpg";
            var fileName      = $"{Guid.NewGuid()}{ext}";

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var localUrl = await imageStorage.SaveAsync(stream, fileName, contentType, ct);

            _db.ProductImages.Add(new Entities.Catalog.ProductImage
            {
                ProductId       = candidate.ProductId,
                Url             = localUrl,
                StorageProvider = imageStorage.ProviderName,
                IsPrimary       = true,
                SortOrder       = 0
            });

            candidate.LocalUrl           = localUrl;
            candidate.Status             = ImageCandidateStatus.Approved;
            candidate.ReviewedByUserId   = UserId;
            candidate.ReviewedAtUtc      = DateTime.UtcNow;

            _db.ProductChangeLogs.Add(new Entities.Audit.ProductChangeLog
            {
                CompanyId       = CompanyId,
                ProductId       = candidate.ProductId,
                Source          = Entities.Audit.ChangeSource.Admin,
                FieldName       = "Image",
                OldValue        = null,
                NewValue        = localUrl,
                ChangedAtUtc    = DateTime.UtcNow,
                ChangedByUserId = UserId
            });

            await _db.SaveChangesAsync(ct);
            return Ok(new { localUrl, message = "Imagem aprovada e aplicada ao produto." });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = $"Falha ao baixar imagem: {ex.Message}" });
        }
    }

    /// <summary>Rejeita uma candidata de imagem — produto não é alterado.</summary>
    [HttpPost("review/images/{candidateId:guid}/reject")]
    public async Task<IActionResult> RejectImage(Guid candidateId, CancellationToken ct)
    {
        var candidate = await _db.ProductImageCandidates
            .FirstOrDefaultAsync(c => c.Id == candidateId && c.CompanyId == CompanyId, ct);

        if (candidate is null) return NotFound();
        if (candidate.Status != ImageCandidateStatus.Pending)
            return BadRequest("Candidata não está pendente.");

        candidate.Status           = ImageCandidateStatus.Rejected;
        candidate.ReviewedByUserId = UserId;
        candidate.ReviewedAtUtc    = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Candidata rejeitada." });
    }

    // ═══════════════════════════════════════════════════════════════
    // NORMALIZAÇÃO DE CATEGORIAS
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Normaliza nomes de todas as categorias da empresa usando as mesmas
    /// regras determinísticas aplicadas aos produtos (title case, abreviações, etc).
    /// Aplica diretamente sem fila de revisão.
    /// </summary>
    [HttpPost("normalize-categories")]
    public async Task<IActionResult> NormalizeCategories(
        [FromServices] ProductNormalizationService normalizer,
        CancellationToken ct)
    {
        var categories = await _db.Categories
            .Where(c => c.CompanyId == CompanyId)
            .ToListAsync(ct);

        int changed = 0;
        foreach (var cat in categories)
        {
            var result = normalizer.Normalize(cat.Name);
            if (!result.HasChanges) continue;

            cat.Name = result.SuggestedName;
            // Regenera slug a partir do novo nome
            cat.Slug = GenerateSlug(result.SuggestedName);
            changed++;
        }

        if (changed > 0)
            await _db.SaveChangesAsync(ct);

        return Ok(new { changed, message = $"{changed} categoria(s) normalizada(s)." });
    }

    private static string GenerateSlug(string name)
    {
        var normalized = name.ToLowerInvariant()
            .Normalize(System.Text.NormalizationForm.FormD);
        var chars = normalized
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                        != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray();
        return System.Text.RegularExpressions.Regex.Replace(
            new string(chars).Trim(),
            @"[^a-z0-9]+", "-").Trim('-');
    }

    // ═══════════════════════════════════════════════════════════════
    // REPROCESSAMENTO
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Cria um lote para reprocessar apenas produtos sem imagem.
    /// Enfileira o job de matching de imagem (se EnableImageMatching = true).
    /// </summary>
    [HttpPost("reprocess-without-image")]
    public async Task<IActionResult> ReprocessWithoutImage(CancellationToken ct)
    {
        var batch = await _batchService.CreateBatchAsync(
            companyId: CompanyId,
            trigger:   EnrichmentTrigger.Manual,
            scope:     EnrichmentScope.WithoutImage,
            ct:        ct);

        if (batch.TotalQueued > 0)
        {
            _jobs.Enqueue<EnrichNormalizeProductsJob>(
                j => j.ExecuteAsync(batch.Id, CancellationToken.None));

            _jobs.Enqueue<EnrichMatchImagesJob>(
                j => j.ExecuteAsync(batch.Id, CancellationToken.None));
        }

        return Ok(new { batchId = batch.Id, totalQueued = batch.TotalQueued,
            message = batch.TotalQueued == 0
                ? "Nenhum produto sem imagem encontrado."
                : $"{batch.TotalQueued} produto(s) enfileirado(s) para reprocessamento." });
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var config = await _batchService.GetOrCreateConfigAsync(CompanyId, ct);
        return Ok(MapConfig(config));
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig(
        [FromBody] UpdateEnrichmentConfigRequest req,
        CancellationToken ct)
    {
        // Validações básicas de threshold
        if (req.AutoApplyImageThreshold is < 0 or > 1)
            return BadRequest("AutoApplyImageThreshold deve estar entre 0 e 1.");
        if (req.ReviewImageThreshold is < 0 or > 1)
            return BadRequest("ReviewImageThreshold deve estar entre 0 e 1.");
        if (req.ReviewImageThreshold > req.AutoApplyImageThreshold)
            return BadRequest("ReviewImageThreshold deve ser menor ou igual a AutoApplyImageThreshold.");
        if (req.BatchSize is < 1 or > 500)
            return BadRequest("BatchSize deve estar entre 1 e 500.");
        if (req.DelayBetweenItemsMs is < 0 or > 10000)
            return BadRequest("DelayBetweenItemsMs deve estar entre 0 e 10000.");

        var config = await _batchService.GetOrCreateConfigAsync(CompanyId, ct);

        config.AutoApplyImageThreshold = req.AutoApplyImageThreshold;
        config.ReviewImageThreshold    = req.ReviewImageThreshold;
        config.AutoApplyNameThreshold  = req.AutoApplyNameThreshold;
        config.BatchSize               = req.BatchSize;
        config.DelayBetweenItemsMs     = req.DelayBetweenItemsMs;
        config.EnableImageMatching     = req.EnableImageMatching;
        config.EnableNameNormalization = req.EnableNameNormalization;

        await _batchService.SaveConfigAsync(config, ct);
        return Ok(MapConfig(config));
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    // ═══════════════════════════════════════════════════════════════
    // IMAGE PICKER — busca manual de imagem por nome no Mercado Livre
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Busca imagens no Mercado Livre para o picker manual do admin.
    /// Retorna até 5 itens, cada um com múltiplas fotos.
    /// </summary>
    [HttpGet("image-search")]
    public async Task<IActionResult> ImageSearch(
        [FromQuery] string q,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "Parâmetro 'q' é obrigatório." });

        var results = await _googleMatcher.SearchForPickerAsync(q, ct);
        return Ok(results);
    }

    /// <summary>
    /// Aplica uma URL de imagem diretamente a um produto (substitui imagem primária).
    /// </summary>
    [HttpPut("products/{productId:guid}/image")]
    public async Task<IActionResult> SetProductImage(
        Guid productId,
        [FromBody] SetProductImageRequest req,
        CancellationToken ct)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Url))
            return BadRequest(new { error = "URL da imagem é obrigatória." });

        // Remove imagens primárias existentes
        var existing = await _db.ProductImages
            .Where(i => i.ProductId == productId && i.IsPrimary)
            .ToListAsync(ct);
        _db.ProductImages.RemoveRange(existing);

        _db.ProductImages.Add(new Petshop.Api.Entities.Catalog.ProductImage
        {
            ProductId       = productId,
            Url             = req.Url,
            StorageProvider = "ExternalUrl",
            IsPrimary       = true,
            SortOrder       = 0
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { url = req.Url });
    }

    private static EnrichmentBatchResponse MapBatch(EnrichmentBatch b) => new(
        b.Id, b.Trigger.ToString(), b.Status.ToString(),
        b.TotalQueued, b.Processed, b.NamesNormalized,
        b.ImagesApplied, b.PendingReview, b.FailedItems,
        b.StartedAtUtc, b.FinishedAtUtc, b.ErrorMessage, b.CreatedAtUtc);

    private static EnrichmentConfigResponse MapConfig(EnrichmentConfig c) => new(
        c.AutoApplyImageThreshold, c.ReviewImageThreshold,
        c.AutoApplyNameThreshold, c.BatchSize,
        c.DelayBetweenItemsMs, c.EnableImageMatching, c.EnableNameNormalization);
}

public record SetProductImageRequest(string Url);
