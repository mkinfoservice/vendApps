using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Sync;

public enum SyncItemAction { Insert, Update, Skip, Conflict }

public class ProductSyncItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid JobId { get; set; }
    public ProductSyncJob Job { get; set; } = default!;

    [MaxLength(200)]
    public string? ExternalId { get; set; }

    [MaxLength(60)]
    public string? InternalCode { get; set; }

    [MaxLength(30)]
    public string? Barcode { get; set; }

    public SyncItemAction Action { get; set; }

    [MaxLength(250)]
    public string? Reason { get; set; }

    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }

    [MaxLength(64)]
    public string? HashBefore { get; set; }

    [MaxLength(64)]
    public string? HashAfter { get; set; }
}
