using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Customers;

public class LoyaltyTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Guid CustomerId { get; set; }
    public Petshop.Api.Entities.Customer? Customer { get; set; }

    /// <summary>Venda relacionada (opcional).</summary>
    public Guid? SaleOrderId { get; set; }

    /// <summary>Positivo = acúmulo, Negativo = resgate, Zero = ajuste manual.</summary>
    public int Points { get; set; }

    public int BalanceBefore { get; set; }
    public int BalanceAfter { get; set; }

    [MaxLength(200)]
    public string Description { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
