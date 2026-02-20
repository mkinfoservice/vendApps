using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Sync;

public class ExternalProductSnapshot
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid ExternalSourceId { get; set; }
    public ExternalSource ExternalSource { get; set; } = default!;

    [Required, MaxLength(200)]
    public string ExternalId { get; set; } = default!;

    public DateTime LastSeenAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ExternalUpdatedAtUtc { get; set; }

    [Required, MaxLength(64)]
    public string ContentHash { get; set; } = default!;

    public Guid? LastSyncJobId { get; set; }
}
