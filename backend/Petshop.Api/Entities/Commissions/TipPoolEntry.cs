using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Commissions;

public class TipPoolEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public DateTime ReferenceDateUtc { get; set; } = DateTime.UtcNow.Date;

    public int AmountCents { get; set; }

    [MaxLength(250)]
    public string Description { get; set; } = "";

    [MaxLength(120)]
    public string CreatedBy { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
