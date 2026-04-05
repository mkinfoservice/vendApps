using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Promotions;

/// <summary>Tipo de desconto aplicado pela promoção.</summary>
public enum PromotionType
{
    PercentDiscount = 0,  // desconto percentual (value = %)
    FixedAmount     = 1,  // desconto em valor fixo (value = centavos)
}

/// <summary>
/// Escopo de abrangência: quais produtos/categorias/marcas se qualificam.
/// </summary>
public enum PromotionScope
{
    All      = 0,   // toda a compra
    Category = 1,   // itens de uma categoria específica
    Brand    = 2,   // itens de uma marca específica
    Product  = 3,   // um produto específico
}

public class Promotion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    [Required, MaxLength(120)]
    public string Name { get; set; } = "";

    [MaxLength(300)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public PromotionType  Type  { get; set; } = PromotionType.PercentDiscount;
    public PromotionScope Scope { get; set; } = PromotionScope.All;

    /// <summary>
    /// ID da categoria, marca ou produto alvo (null quando Scope = All).
    /// </summary>
    public Guid? TargetId { get; set; }

    /// <summary>Nome denormalizado do alvo — facilita listagem sem joins.</summary>
    [MaxLength(120)]
    public string? TargetName { get; set; }

    /// <summary>
    /// Para PercentDiscount: porcentagem (ex: 10.00 = 10%).
    /// Para FixedAmount: valor em centavos (ex: 500 = R$5,00).
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal Value { get; set; }

    /// <summary>Código de cupom. Null = promoção automática sem código.</summary>
    [MaxLength(40)]
    public string? CouponCode { get; set; }

    /// <summary>Valor mínimo do pedido para ativar (centavos). Null = sem mínimo.</summary>
    public int? MinOrderCents { get; set; }

    /// <summary>Teto máximo do desconto em centavos (só para PercentDiscount). Null = sem teto.</summary>
    public int? MaxDiscountCents { get; set; }

    /// <summary>
    /// Custo em pontos para disponibilizar esta promocao como recompensa no programa de fidelidade.
    /// Null ou <= 0 = nao aparece no catalogo de recompensas.
    /// </summary>
    public int? LoyaltyPointsCost { get; set; }

    public DateTime? StartsAtUtc  { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }

    public DateTime  CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
