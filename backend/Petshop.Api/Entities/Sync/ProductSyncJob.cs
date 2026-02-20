using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Sync;

public enum SyncTriggeredBy { Manual, Admin, Scheduler }
public enum SyncType { Full, Delta }
public enum SyncJobStatus { Queued, Running, Done, Failed }

public class ProductSyncJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public Guid ExternalSourceId { get; set; }
    public ExternalSource ExternalSource { get; set; } = default!;

    public SyncTriggeredBy TriggeredBy { get; set; } = SyncTriggeredBy.Manual;

    public SyncType SyncType { get; set; } = SyncType.Full;

    public DateTime? FilterUpdatedSinceUtc { get; set; }

    public SyncJobStatus Status { get; set; } = SyncJobStatus.Queued;

    public int TotalFetched { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Unchanged { get; set; }
    public int Skipped { get; set; }
    public int Conflicts { get; set; }

    public DateTime? StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    public List<ProductSyncItem> Items { get; set; } = new();
}
