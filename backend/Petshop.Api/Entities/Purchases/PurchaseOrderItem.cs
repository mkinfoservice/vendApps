using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Petshop.Api.Entities.Purchases;

public class PurchaseOrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    public Guid ProductId { get; set; }

    [MaxLength(160)]
    public string ProductNameSnapshot { get; set; } = "";

    [MaxLength(30)]
    public string? ProductBarcodeSnapshot { get; set; }

    [Column(TypeName = "decimal(14,3)")]
    public decimal Qty { get; set; }

    public int UnitCostCents { get; set; }
    public int TotalCents { get; set; }
}
