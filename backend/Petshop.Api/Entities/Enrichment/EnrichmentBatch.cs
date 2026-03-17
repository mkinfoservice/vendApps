using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Entities.Enrichment;

public enum EnrichmentBatchStatus { Queued, Running, Done, Failed }
public enum EnrichmentTrigger { Manual, PostSync, Scheduled }

/// <summary>
/// Representa um lote de enriquecimento de catálogo.
/// Criado manualmente pelo admin ou automaticamente após um sync de produtos.
/// </summary>
public class EnrichmentBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public EnrichmentTrigger Trigger { get; set; } = EnrichmentTrigger.Manual;

    /// <summary>Sync que originou este lote (preenchido quando Trigger = PostSync).</summary>
    public Guid? SyncJobId { get; set; }
    public ProductSyncJob? SyncJob { get; set; }

    public EnrichmentBatchStatus Status { get; set; } = EnrichmentBatchStatus.Queued;

    // ── Estatísticas ──────────────────────────────────────────────────────────
    public int TotalQueued { get; set; }
    public int Processed { get; set; }
    public int NamesNormalized { get; set; }
    public int ImagesApplied { get; set; }
    public int PendingReview { get; set; }
    public int FailedItems { get; set; }

    public DateTime? StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<ProductEnrichmentResult> Results { get; set; } = new();
}
