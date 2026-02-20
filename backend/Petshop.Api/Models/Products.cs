using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Models;

public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // ── Tenant ──────────────────────────────────────────────
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Identificação ────────────────────────────────────────
    [Required, MaxLength(160)]
    public string Name { get; set; } = default!;

    [Required, MaxLength(160)]
    public string Slug { get; set; } = default!;

    [MaxLength(60)]
    public string? InternalCode { get; set; }

    [MaxLength(30)]
    public string? Barcode { get; set; }

    // ── Classificação ────────────────────────────────────────
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = default!;

    public Guid? BrandId { get; set; }
    public Brand? Brand { get; set; }

    // ── Conteúdo ─────────────────────────────────────────────
    public string? Description { get; set; }

    [MaxLength(10)]
    public string Unit { get; set; } = "UN";

    // ── Preço e custo (em centavos) ──────────────────────────
    [Range(0, int.MaxValue)]
    public int PriceCents { get; set; }

    [Range(0, int.MaxValue)]
    public int CostCents { get; set; } = 0;

    /// <summary>Margem calculada: ((Price - Cost) / Price) * 100. Armazenada para consulta.</summary>
    [Column(TypeName = "decimal(10,4)")]
    public decimal MarginPercent { get; set; } = 0;

    // ── Estoque ──────────────────────────────────────────────
    [Column(TypeName = "decimal(14,3)")]
    public decimal StockQty { get; set; } = 0;

    // ── Fiscal ───────────────────────────────────────────────
    [MaxLength(10)]
    public string? Ncm { get; set; }

    // ── Imagem legada (mantida para compatibilidade com OrderItem) ──
    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    // ── Status ───────────────────────────────────────────────
    public bool IsActive { get; set; } = true;

    // ── Timestamps ───────────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // ── Concorrência ─────────────────────────────────────────
    [Timestamp]
    public byte[]? RowVersion { get; set; }

    // ── Navegações ────────────────────────────────────────────
    public List<ProductVariant> Variants { get; set; } = new();
    public List<ProductImage> Images { get; set; } = new();
}
