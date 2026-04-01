using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Commissions;

public class CommissionConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public bool IsEnabled { get; set; } = true;
    public bool IsTipEnabled { get; set; } = true;

    [Column(TypeName = "decimal(5,2)")]
    public decimal DefaultCommissionPercent { get; set; } = 2.5m;

    /// <summary>"equal" | "proportional_sales" | "proportional_commission"</summary>
    public string TipDistributionMode { get; set; } = "proportional_sales";

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
