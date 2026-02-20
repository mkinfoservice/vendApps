using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Audit;

public enum ChangeSource { Manual, Admin, Sync }

public class ProductChangeLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public ChangeSource Source { get; set; } = ChangeSource.Manual;

    public Guid? ExternalSourceId { get; set; }

    [Required, MaxLength(80)]
    public string FieldName { get; set; } = default!;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string? ChangedByUserId { get; set; }

    public Guid? SyncJobId { get; set; }
}
