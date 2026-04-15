using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Catalog;

/// <summary>
/// Vínculo entre um produto e um insumo consumido na sua venda.
/// Ex: 1 Frappe consome 1 Copo 300 ml + 0,3 L de Leite.
/// Quando uma venda PDV é concluída, o estoque de cada insumo vinculado
/// é decrementado automaticamente por QuantityPerUnit × Qty vendida.
/// </summary>
public class ProductSupplyLink
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public Guid SupplyId { get; set; }
    public Supply Supply { get; set; } = null!;

    /// <summary>
    /// Quantidade do insumo consumida por unidade vendida do produto.
    /// Ex: 0.3 (litros de leite por 1 frappe).
    /// </summary>
    [Column(TypeName = "decimal(14,4)")]
    public decimal QuantityPerUnit { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
