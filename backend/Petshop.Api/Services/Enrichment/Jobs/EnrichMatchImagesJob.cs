using Petshop.Api.Services.Enrichment;

namespace Petshop.Api.Services.Enrichment.Jobs;

/// <summary>
/// Job Hangfire que executa o matching de imagens de um lote de enriquecimento.
/// Só processa se EnableImageMatching = true na EnrichmentConfig da empresa.
/// Enfileirado pelo CatalogEnrichmentController (opcionalmente, após normalização).
/// </summary>
public sealed class EnrichMatchImagesJob
{
    private readonly CatalogEnrichmentOrchestrator _orchestrator;
    private readonly ILogger<EnrichMatchImagesJob> _logger;

    public EnrichMatchImagesJob(
        CatalogEnrichmentOrchestrator orchestrator,
        ILogger<EnrichMatchImagesJob> logger)
    {
        _orchestrator = orchestrator;
        _logger       = logger;
    }

    public async Task ExecuteAsync(Guid batchId, CancellationToken ct = default)
    {
        _logger.LogInformation("Job de matching de imagem iniciado para lote {BatchId}", batchId);
        await _orchestrator.RunImageMatchingAsync(batchId, ct);
        _logger.LogInformation("Job de matching de imagem concluído para lote {BatchId}", batchId);
    }
}
