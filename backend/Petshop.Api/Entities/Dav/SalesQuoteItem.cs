using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Petshop.Api.Entities.Dav;

public class SalesQuoteItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SalesQuoteId { get; set; }
    public SalesQuote SalesQuote { get; set; } = default!;

    public Guid ProductId { get; set; }

    [MaxLength(160)]
    public string ProductNameSnapshot { get; set; } = "";

    [MaxLength(20)]
    public string? ProductBarcodeSnapshot { get; set; }

    /// <summary>
    /// Quantidade (decimal para suportar produtos por peso, ex: 0.350 kg).
    /// Para produtos convencionais: número inteiro como decimal (ex: 2.000).
    /// </summary>
    [Column(TypeName = "decimal(14,3)")]
    public decimal Qty { get; set; }

    /// <summary>Preço unitário no momento do DAV (em centavos). Para produtos por peso: preço/kg.</summary>
    public int UnitPriceCentsSnapshot { get; set; }

    /// <summary>Total calculado em centavos = Qty × UnitPrice (ou WeightKg × UnitPrice para balança).</summary>
    public int TotalCents { get; set; }

    // ── Campos de balança (produtos por peso) ─────────────────────────────
    /// <summary>True quando o produto é vendido por peso.</summary>
    public bool IsSoldByWeight { get; set; } = false;

    /// <summary>Peso líquido em kg (após tara) — preenchido para produtos de balança.</summary>
    [Column(TypeName = "decimal(8,3)")]
    public decimal? WeightKg { get; set; }
}
