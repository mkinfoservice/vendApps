using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Pdv;

public class SalePayment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SaleOrderId { get; set; }
    public SaleOrder SaleOrder { get; set; } = default!;

    /// <summary>Forma de pagamento: PIX, DINHEIRO, CARTAO_CREDITO, CARTAO_DEBITO, etc.</summary>
    [MaxLength(50)]
    public string PaymentMethod { get; set; } = "PIX";

    public int AmountCents { get; set; }

    /// <summary>Troco (para pagamento em dinheiro).</summary>
    public int ChangeCents { get; set; } = 0;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
