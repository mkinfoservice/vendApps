using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Master;

namespace Petshop.Api.Entities.Commissions;

public class EmployeeCommissionAdjustment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public Guid AdminUserId { get; set; }
    public AdminUser AdminUser { get; set; } = default!;

    public DateTime ReferenceDateUtc { get; set; } = DateTime.UtcNow.Date;

    /// <summary>Valor em centavos (pode ser negativo para desconto).</summary>
    public int AmountCents { get; set; }

    [MaxLength(250)]
    public string Description { get; set; } = "";

    [MaxLength(120)]
    public string CreatedBy { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
