using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Master;

namespace Petshop.Api.Entities.Commissions;

public class EmployeeCommissionRate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public Guid AdminUserId { get; set; }
    public AdminUser AdminUser { get; set; } = default!;

    [Column(TypeName = "decimal(5,2)")]
    public decimal CommissionPercent { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
