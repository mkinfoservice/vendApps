using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Audit;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Models;
using System.Text.Json;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Orquestrador central do sync de produtos.
/// Fluxo: Criar Job → Buscar produtos da origem → Comparar hash → Merge Policy → Salvar.
/// </summary>
public class ProductSyncService
{
    private readonly AppDbContext _db;
    private readonly ConnectorFactory _connectorFactory;
    private readonly ProductHashService _hashService;
    private readonly SyncMergePolicyService _policyService;
    private readonly ILogger<ProductSyncService> _logger;

    public ProductSyncService(
        AppDbContext db,
        ConnectorFactory connectorFactory,
        ProductHashService hashService,
        SyncMergePolicyService policyService,
        ILogger<ProductSyncService> logger)
    {
        _db = db;
        _connectorFactory = connectorFactory;
        _hashService = hashService;
        _policyService = policyService;
        _logger = logger;
    }

    public async Task<ProductSyncJob> RunAsync(
        Guid companyId,
        Guid sourceId,
        SyncType syncType,
        DateTime? updatedSince,
        int batchSize,
        SyncTriggeredBy triggeredBy,
        CancellationToken ct)
    {
        var source = await _db.ExternalSources
            .Include(s => s.Company)
            .FirstOrDefaultAsync(s => s.Id == sourceId && s.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException($"Fonte {sourceId} não encontrada.");

        var job = new ProductSyncJob
        {
            CompanyId = companyId,
            ExternalSourceId = sourceId,
            TriggeredBy = triggeredBy,
            SyncType = syncType,
            FilterUpdatedSinceUtc = updatedSince,
            Status = SyncJobStatus.Running,
            StartedAtUtc = DateTime.UtcNow
        };
        _db.ProductSyncJobs.Add(job);
        await _db.SaveChangesAsync(ct);

        try
        {
            var policy = _policyService.GetPolicy(source.Company);
            var connector = _connectorFactory.Create(source);
            var page = 1;
            int totalFetched = 0, inserted = 0, updated = 0, unchanged = 0, skipped = 0, conflicts = 0;

            while (true)
            {
                var query = new ExternalProductQuery
                {
                    SourceId = sourceId,
                    SyncType = syncType,
                    UpdatedSince = updatedSince,
                    BatchSize = batchSize,
                    Page = page
                };

                var batch = await connector.FetchProductsAsync(query, ct);
                if (batch.Count == 0) break;

                totalFetched += batch.Count;

                foreach (var dto in batch)
                {
                    if (ct.IsCancellationRequested) break;

                    var result = await ProcessProductAsync(dto, job, source, policy, ct);
                    switch (result)
                    {
                        case SyncItemAction.Insert:    inserted++;   break;
                        case SyncItemAction.Update:    updated++;    break;
                        case SyncItemAction.Skip:      unchanged++;  break;
                        case SyncItemAction.Conflict:  conflicts++;  break;
                    }
                }

                if (batch.Count < batchSize) break;
                page++;
            }

            job.TotalFetched = totalFetched;
            job.Inserted = inserted;
            job.Updated = updated;
            job.Unchanged = unchanged;
            job.Skipped = skipped;
            job.Conflicts = conflicts;
            job.Status = SyncJobStatus.Done;
            job.FinishedAtUtc = DateTime.UtcNow;

            source.LastSyncAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("Sync {JobId} concluído: {Inserted} inseridos, {Updated} atualizados, {Unchanged} sem mudança, {Conflicts} conflitos",
                job.Id, inserted, updated, unchanged, conflicts);
        }
        catch (Exception ex)
        {
            job.Status = SyncJobStatus.Failed;
            job.ErrorMessage = ex.Message;
            job.FinishedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(CancellationToken.None);

            _logger.LogError(ex, "Sync {JobId} falhou: {Message}", job.Id, ex.Message);
        }

        return job;
    }

    private async Task<SyncItemAction> ProcessProductAsync(
        ExternalProductDto dto,
        ProductSyncJob job,
        ExternalSource source,
        MergePolicy policy,
        CancellationToken ct)
    {
        var externalId = dto.ExternalId ?? dto.InternalCode ?? dto.Barcode;
        if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(dto.Name))
        {
            await RecordItemAsync(job, dto, SyncItemAction.Skip, "ExternalId ou Name ausente", null, null, ct);
            return SyncItemAction.Skip;
        }

        var hash = string.IsNullOrEmpty(dto.RawHash) ? _hashService.ComputeHash(dto) : dto.RawHash;

        // Busca snapshot anterior
        var snapshot = await _db.ExternalProductSnapshots
            .FirstOrDefaultAsync(s => s.CompanyId == source.CompanyId
                && s.ExternalSourceId == source.Id
                && s.ExternalId == externalId, ct);

        if (snapshot != null && snapshot.ContentHash == hash)
        {
            // Produto não mudou
            snapshot.LastSeenAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return SyncItemAction.Skip;
        }

        // Tenta encontrar produto existente por ExternalId (via InternalCode ou Barcode)
        var existing = await FindExistingProductAsync(source.CompanyId, dto, ct);

        string? beforeJson = existing != null ? JsonSerializer.Serialize(new
        {
            existing.PriceCents, existing.CostCents, existing.Name, existing.StockQty,
            existing.Description, existing.IsActive
        }) : null;

        SyncItemAction action;

        if (existing == null)
        {
            // Inserir novo produto
            var category = await FindOrCreateCategoryAsync(source.CompanyId, dto.CategoryName, ct);
            var brand = dto.BrandName != null ? await FindOrCreateBrandAsync(source.CompanyId, dto.BrandName, ct) : null;

            var slug = GenerateSlug(source.CompanyId, dto.Name, dto);
            var product = new Product
            {
                CompanyId = source.CompanyId,
                Name = dto.Name,
                Slug = slug,
                InternalCode = dto.InternalCode,
                Barcode = dto.Barcode,
                Description = dto.Description,
                Unit = dto.Unit,
                CostCents = dto.CostCents,
                PriceCents = dto.PriceCents,
                StockQty = dto.StockQty,
                IsActive = dto.IsActive,
                Ncm = dto.Ncm,
                CategoryId = category.Id,
                BrandId = brand?.Id,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            product.MarginPercent = product.PriceCents > 0
                ? Math.Round((decimal)(product.PriceCents - product.CostCents) / product.PriceCents * 100, 4)
                : 0;

            _db.Products.Add(product);
            await _db.SaveChangesAsync(ct);

            await RecordPriceHistoryAsync(product, ChangeSource.Sync, job.Id, ct);
            action = SyncItemAction.Insert;

            var afterJson = JsonSerializer.Serialize(new { product.PriceCents, product.CostCents, product.Name, product.StockQty });
            await RecordItemAsync(job, dto, SyncItemAction.Insert, "Novo produto inserido", null, afterJson, ct);
            await UpsertSnapshotAsync(source.CompanyId, source.Id, externalId, hash, dto.UpdatedAtUtc, job.Id, ct);
        }
        else
        {
            // Atualizar produto existente
            bool priceChanged = false;
            var oldPrice = existing.PriceCents;
            var oldCost = existing.CostCents;

            if (_policyService.ShouldUpdateField("Name", policy) && existing.Name != dto.Name)
            {
                await LogChangeAsync(existing, "Name", existing.Name, dto.Name, job.Id, ct);
                existing.Name = dto.Name;
            }
            if (_policyService.ShouldUpdateField("Description", policy))
                existing.Description = dto.Description;
            if (_policyService.ShouldUpdateField("PriceCents", policy) && existing.PriceCents != dto.PriceCents)
            {
                await LogChangeAsync(existing, "PriceCents", existing.PriceCents.ToString(), dto.PriceCents.ToString(), job.Id, ct);
                existing.PriceCents = dto.PriceCents;
                priceChanged = true;
            }
            if (_policyService.ShouldUpdateField("CostCents", policy) && existing.CostCents != dto.CostCents)
            {
                await LogChangeAsync(existing, "CostCents", existing.CostCents.ToString(), dto.CostCents.ToString(), job.Id, ct);
                existing.CostCents = dto.CostCents;
                priceChanged = true;
            }
            if (_policyService.ShouldUpdateField("StockQty", policy))
                existing.StockQty = dto.StockQty;

            existing.MarginPercent = existing.PriceCents > 0
                ? Math.Round((decimal)(existing.PriceCents - existing.CostCents) / existing.PriceCents * 100, 4)
                : 0;
            existing.UpdatedAtUtc = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            if (priceChanged)
                await RecordPriceHistoryAsync(existing, ChangeSource.Sync, job.Id, ct);

            var afterJson2 = JsonSerializer.Serialize(new { existing.PriceCents, existing.CostCents, existing.Name, existing.StockQty });
            await RecordItemAsync(job, dto, SyncItemAction.Update, "Produto atualizado", beforeJson, afterJson2, ct);
            await UpsertSnapshotAsync(source.CompanyId, source.Id, externalId, hash, dto.UpdatedAtUtc, job.Id, ct);
            action = SyncItemAction.Update;
        }

        return action;
    }

    private async Task<Product?> FindExistingProductAsync(Guid companyId, ExternalProductDto dto, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(dto.InternalCode))
        {
            var p = await _db.Products.FirstOrDefaultAsync(p =>
                p.CompanyId == companyId && p.InternalCode == dto.InternalCode, ct);
            if (p != null) return p;
        }
        if (!string.IsNullOrWhiteSpace(dto.Barcode))
        {
            var p = await _db.Products.FirstOrDefaultAsync(p =>
                p.CompanyId == companyId && p.Barcode == dto.Barcode, ct);
            if (p != null) return p;
        }
        return null;
    }

    private async Task<Category> FindOrCreateCategoryAsync(Guid companyId, string? name, CancellationToken ct)
    {
        name = string.IsNullOrWhiteSpace(name) ? "Geral" : name.Trim();
        var slug = Slugify(name);

        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Slug == slug, ct);
        if (cat != null) return cat;

        cat = new Category { CompanyId = companyId, Name = name, Slug = slug };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return cat;
    }

    private async Task<Brand?> FindOrCreateBrandAsync(Guid companyId, string name, CancellationToken ct)
    {
        var slug = Slugify(name);
        var brand = await _db.Brands.FirstOrDefaultAsync(b => b.CompanyId == companyId && b.Slug == slug, ct);
        if (brand != null) return brand;

        brand = new Brand { CompanyId = companyId, Name = name.Trim(), Slug = slug };
        _db.Brands.Add(brand);
        await _db.SaveChangesAsync(ct);
        return brand;
    }

    private string GenerateSlug(Guid companyId, string name, ExternalProductDto dto)
    {
        var baseSlug = Slugify(name);
        var suffix = dto.InternalCode ?? dto.Barcode ?? Guid.NewGuid().ToString()[..8];
        return $"{baseSlug}-{Slugify(suffix)}";
    }

    private static string Slugify(string text) =>
        System.Text.RegularExpressions.Regex.Replace(
            text.Trim().ToLowerInvariant()
                .Replace("ã", "a").Replace("â", "a").Replace("á", "a").Replace("à", "a")
                .Replace("ê", "e").Replace("é", "e").Replace("è", "e")
                .Replace("î", "i").Replace("í", "i")
                .Replace("ô", "o").Replace("ó", "o").Replace("õ", "o")
                .Replace("û", "u").Replace("ú", "u").Replace("ü", "u")
                .Replace("ç", "c").Replace(" ", "-"),
            @"[^a-z0-9\-]", "");

    private async Task UpsertSnapshotAsync(Guid companyId, Guid sourceId, string externalId, string hash,
        DateTime? externalUpdatedAt, Guid jobId, CancellationToken ct)
    {
        var snap = await _db.ExternalProductSnapshots.FirstOrDefaultAsync(s =>
            s.CompanyId == companyId && s.ExternalSourceId == sourceId && s.ExternalId == externalId, ct);

        if (snap == null)
        {
            _db.ExternalProductSnapshots.Add(new Entities.Sync.ExternalProductSnapshot
            {
                CompanyId = companyId,
                ExternalSourceId = sourceId,
                ExternalId = externalId,
                ContentHash = hash,
                LastSeenAtUtc = DateTime.UtcNow,
                ExternalUpdatedAtUtc = externalUpdatedAt,
                LastSyncJobId = jobId
            });
        }
        else
        {
            snap.ContentHash = hash;
            snap.LastSeenAtUtc = DateTime.UtcNow;
            snap.ExternalUpdatedAtUtc = externalUpdatedAt ?? snap.ExternalUpdatedAtUtc;
            snap.LastSyncJobId = jobId;
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task RecordItemAsync(ProductSyncJob job, ExternalProductDto dto, SyncItemAction action,
        string? reason, string? before, string? after, CancellationToken ct)
    {
        _db.ProductSyncItems.Add(new Entities.Sync.ProductSyncItem
        {
            JobId = job.Id,
            ExternalId = dto.ExternalId,
            InternalCode = dto.InternalCode,
            Barcode = dto.Barcode,
            Action = action,
            Reason = reason,
            BeforeJson = before,
            AfterJson = after
        });
        await _db.SaveChangesAsync(ct);
    }

    private async Task RecordPriceHistoryAsync(Product product, ChangeSource source, Guid jobId, CancellationToken ct)
    {
        _db.ProductPriceHistories.Add(new Entities.Audit.ProductPriceHistory
        {
            ProductId = product.Id,
            PriceCents = product.PriceCents,
            CostCents = product.CostCents,
            MarginPercent = product.MarginPercent,
            ChangedAtUtc = DateTime.UtcNow,
            Source = source,
            SyncJobId = jobId
        });
        await _db.SaveChangesAsync(ct);
    }

    private async Task LogChangeAsync(Product product, string field, string? oldVal, string? newVal,
        Guid jobId, CancellationToken ct)
    {
        _db.ProductChangeLogs.Add(new Entities.Audit.ProductChangeLog
        {
            CompanyId = product.CompanyId,
            ProductId = product.Id,
            Source = ChangeSource.Sync,
            FieldName = field,
            OldValue = oldVal,
            NewValue = newVal,
            ChangedAtUtc = DateTime.UtcNow,
            SyncJobId = jobId
        });
        await _db.SaveChangesAsync(ct);
    }
}
