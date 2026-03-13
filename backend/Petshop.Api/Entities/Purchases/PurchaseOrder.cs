using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Purchases;

public class PurchaseOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;

    /// <summary>Número da NF do fornecedor.</summary>
    [MaxLength(60)]
    public string? InvoiceNumber { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>Soma de TotalCents de todos os itens.</summary>
    public int TotalCents { get; set; }

    public DateTime? OrderedAtUtc { get; set; }
    public DateTime? ReceivedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    public List<PurchaseOrderItem> Items { get; set; } = new();
}
