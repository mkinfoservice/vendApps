using Petshop.Api.Services.Enrichment;

namespace Petshop.Api.Services.Enrichment.Jobs;

/// <summary>
/// Job Hangfire que executa a normalização de nomes de um lote de enriquecimento.
/// Enfileirado pelo CatalogEnrichmentController após criar o EnrichmentBatch.
/// Registrado via IBackgroundJobClient.Enqueue — não é recorrente.
/// </summary>
public sealed class EnrichNormalizeProductsJob
{
    private readonly CatalogEnrichmentOrchestrator _orchestrator;
    private readonly ILogger<EnrichNormalizeProductsJob> _logger;

    public EnrichNormalizeProductsJob(
        CatalogEnrichmentOrchestrator orchestrator,
        ILogger<EnrichNormalizeProductsJob> logger)
    {
        _orchestrator = orchestrator;
        _logger       = logger;
    }

    public async Task ExecuteAsync(Guid batchId, CancellationToken ct = default)
    {
        _logger.LogInformation("Job de normalização iniciado para lote {BatchId}", batchId);
        await _orchestrator.RunNormalizationAsync(batchId, ct);
        _logger.LogInformation("Job de normalização concluído para lote {BatchId}", batchId);
    }
}
