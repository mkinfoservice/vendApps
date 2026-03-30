using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Petshop.Api.Entities.Catalog;

/// <summary>
/// Insumo operacional da empresa (material de consumo interno, não vendido no catálogo).
/// Ex: sacolas, embalagens, produtos de limpeza, etc.
/// Quando StockQty ≤ MinQty, dispara alerta para o proprietário.
/// </summary>
public class Supply
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    [Required, MaxLength(120)]
    public string Name { get; set; } = "";

    /// <summary>Unidade: UN, KG, L, CX, PCT, etc.</summary>
    [MaxLength(10)]
    public string Unit { get; set; } = "UN";

    [MaxLength(60)]
    public string? Category { get; set; }

    [Column(TypeName = "decimal(14,3)")]
    public decimal StockQty { get; set; } = 0;

    /// <summary>Quantidade mínima — ao atingir dispara alerta.</summary>
    [Column(TypeName = "decimal(14,3)")]
    public decimal MinQty { get; set; } = 0;

    /// <summary>Fornecedor preferencial (texto livre).</summary>
    [MaxLength(120)]
    public string? SupplierName { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
