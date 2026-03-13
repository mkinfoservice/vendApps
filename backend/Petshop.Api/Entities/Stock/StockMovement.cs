using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Stock;

/// <summary>
/// Registro imutável de cada alteração no estoque de um produto.
/// Product.StockQty é a posição atual; StockMovement é o ledger de auditoria.
/// </summary>
public class StockMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    public StockMovementType MovementType { get; set; }

    /// <summary>Quantidade movimentada (positivo = entrada, negativo = saída).</summary>
    [Column(TypeName = "decimal(14,3)")]
    public decimal Quantity { get; set; }

    [Column(TypeName = "decimal(14,3)")]
    public decimal BalanceBefore { get; set; }

    [Column(TypeName = "decimal(14,3)")]
    public decimal BalanceAfter { get; set; }

    /// <summary>Custo unitário em centavos no momento do movimento (para entradas).</summary>
    public int? UnitCostCents { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    /// <summary>Se originado de uma venda PDV, referência ao SaleOrder.</summary>
    public Guid? SaleOrderId { get; set; }

    [MaxLength(120)]
    public string? ActorName { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
