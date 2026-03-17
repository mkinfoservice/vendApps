using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Enrichment;
using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Services.Enrichment;

public enum EnrichmentScope
{
    All,              // Todos os produtos ativos
    WithoutImage,     // Apenas produtos sem imagem
    RecentlyImported, // Produtos inseridos/atualizados nas últimas N horas
    ByCategory        // Produtos de uma categoria específica
}

/// <summary>
/// Cria e consulta EnrichmentBatches.
/// Responsabilidade única: gerenciar o ciclo de vida de lotes,
/// NÃO executa o processamento (isso é do CatalogEnrichmentOrchestrator, chamado pelo Job).
/// </summary>
public sealed class EnrichmentBatchService
{
    private readonly AppDbContext _db;
    private readonly ILogger<EnrichmentBatchService> _logger;

    public EnrichmentBatchService(AppDbContext db, ILogger<EnrichmentBatchService> logger)
    {
        _db     = db;
        _logger = logger;
    }

    /// <summary>
    /// Cria um novo lote de enriquecimento e popula os ProductEnrichmentResults.
    /// Retorna o lote criado para que o controller possa enfileirar o job.
    /// </summary>
    public async Task<EnrichmentBatch> CreateBatchAsync(
        Guid companyId,
        EnrichmentTrigger trigger,
        EnrichmentScope scope,
        Guid? categoryId = null,
        int? recentHours = null,
        Guid? syncJobId  = null,
        CancellationToken ct = default)
    {
        // Busca IDs dos produtos elegíveis segundo o escopo
        var productIds = await QueryEligibleProductIdsAsync(companyId, scope, categoryId, recentHours, ct);

        if (productIds.Count == 0)
        {
            _logger.LogInformation("Nenhum produto elegível para enriquecimento (empresa {CompanyId}, escopo {Scope})",
                companyId, scope);
        }

        var batch = new EnrichmentBatch
        {
            CompanyId    = companyId,
            Trigger      = trigger,
            SyncJobId    = syncJobId,
            Status       = EnrichmentBatchStatus.Queued,
            TotalQueued  = productIds.Count,
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.EnrichmentBatches.Add(batch);
        await _db.SaveChangesAsync(ct);

        // Cria um ProductEnrichmentResult por produto
        if (productIds.Count > 0)
        {
            var results = productIds.Select(pid => new ProductEnrichmentResult
            {
                CompanyId = companyId,
                BatchId   = batch.Id,
                ProductId = pid,
                Status    = EnrichmentResultStatus.Queued
            }).ToList();

            _db.ProductEnrichmentResults.AddRange(results);
            await _db.SaveChangesAsync(ct);
        }

        _logger.LogInformation("Lote de enriquecimento {BatchId} criado com {Count} produtos (escopo: {Scope})",
            batch.Id, productIds.Count, scope);

        return batch;
    }

    /// <summary>
    /// Retorna lotes paginados para a empresa, do mais recente ao mais antigo.
    /// </summary>
    public async Task<(int Total, List<EnrichmentBatch> Items)> ListBatchesAsync(
        Guid companyId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var q = _db.EnrichmentBatches
            .AsNoTracking()
            .Where(b => b.CompanyId == companyId)
            .OrderByDescending(b => b.CreatedAtUtc);

        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (total, items);
    }

    /// <summary>
    /// Retorna um lote específico. Valida que pertence à empresa.
    /// </summary>
    public async Task<EnrichmentBatch?> GetBatchAsync(Guid companyId, Guid batchId, CancellationToken ct = default) =>
        await _db.EnrichmentBatches
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == batchId && b.CompanyId == companyId, ct);

    /// <summary>
    /// Retorna ou cria a configuração de enriquecimento da empresa.
    /// </summary>
    public async Task<EnrichmentConfig> GetOrCreateConfigAsync(Guid companyId, CancellationToken ct = default)
    {
        var config = await _db.EnrichmentConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, ct);

        if (config is not null) return config;

        config = new EnrichmentConfig { CompanyId = companyId };
        _db.EnrichmentConfigs.Add(config);
        await _db.SaveChangesAsync(ct);
        return config;
    }

    /// <summary>
    /// Salva a configuração de enriquecimento da empresa.
    /// </summary>
    public async Task SaveConfigAsync(EnrichmentConfig config, CancellationToken ct = default)
    {
        config.UpdatedAtUtc = DateTime.UtcNow;
        _db.EnrichmentConfigs.Update(config);
        await _db.SaveChangesAsync(ct);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private async Task<List<Guid>> QueryEligibleProductIdsAsync(
        Guid companyId,
        EnrichmentScope scope,
        Guid? categoryId,
        int? recentHours,
        CancellationToken ct)
    {
        var q = _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.IsActive);

        q = scope switch
        {
            EnrichmentScope.WithoutImage => q.Where(p =>
                !_db.ProductImages.Any(i => i.ProductId == p.Id) &&
                (p.ImageUrl == null || p.ImageUrl == "")),

            EnrichmentScope.RecentlyImported => q.Where(p =>
                p.CreatedAtUtc >= DateTime.UtcNow.AddHours(-(recentHours ?? 24))),

            EnrichmentScope.ByCategory when categoryId.HasValue => q.Where(p =>
                p.CategoryId == categoryId.Value),

            _ => q // EnrichmentScope.All
        };

        return await q.Select(p => p.Id).ToListAsync(ct);
    }
}
