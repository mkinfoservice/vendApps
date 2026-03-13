using System.ComponentModel.DataAnnotations.Schema;

namespace Petshop.Api.Entities.Customers;

public class LoyaltyConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public bool IsEnabled { get; set; } = true;

    /// <summary>Pontos acumulados por R$1,00 gasto. Ex: 1.0 = 1 ponto por real.</summary>
    [Column(TypeName = "decimal(8,2)")]
    public decimal PointsPerReal { get; set; } = 1.0m;

    /// <summary>Quantos pontos equivalem a R$1,00 no resgate. Ex: 100 pts = R$1.</summary>
    public int PointsPerReais { get; set; } = 100;

    /// <summary>Saldo mínimo para permitir resgate.</summary>
    public int MinRedemptionPoints { get; set; } = 500;

    /// <summary>Percentual máximo de desconto por pontos por venda (0-100).</summary>
    public int MaxDiscountPercent { get; set; } = 50;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
