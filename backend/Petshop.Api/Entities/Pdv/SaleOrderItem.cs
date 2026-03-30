using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Petshop.Api.Entities.Pdv;

public class SaleOrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SaleOrderId { get; set; }
    public SaleOrder SaleOrder { get; set; } = default!;

    public Guid ProductId { get; set; }

    [MaxLength(160)]
    public string ProductNameSnapshot { get; set; } = "";

    [MaxLength(20)]
    public string? ProductBarcodeSnapshot { get; set; }

    [Column(TypeName = "decimal(14,3)")]
    public decimal Qty { get; set; }

    public int UnitPriceCentsSnapshot { get; set; }
    public int TotalCents { get; set; }

    // ── Balança ────────────────────────────────────────────
    public bool IsSoldByWeight { get; set; } = false;

    [Column(TypeName = "decimal(8,3)")]
    public decimal? WeightKg { get; set; }

    // ── Adicionais ─────────────────────────────────────────
    public List<SaleOrderItemAddon> Addons { get; set; } = new();
}
