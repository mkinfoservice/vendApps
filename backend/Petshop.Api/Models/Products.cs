using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Scale;

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

    /// <summary>Ponto de reposição: dispara alerta quando StockQty ≤ ReorderPoint.</summary>
    [Column(TypeName = "decimal(14,3)")]
    public decimal? ReorderPoint { get; set; }

    // ── Fiscal ───────────────────────────────────────────────
    [MaxLength(10)]
    public string? Ncm { get; set; }

    // ── Balança / Venda por peso ──────────────────────────────
    /// <summary>Produto vendido por quilograma (pesado na balança)?</summary>
    public bool IsSoldByWeight { get; set; } = false;

    /// <summary>
    /// Código de 5 dígitos cadastrado na balança (campo PPPPP do barcode EAN-13 interno).
    /// Deve ser único por empresa. Usado para lookup quando o scanner lê etiqueta de balança.
    /// Quando IsSoldByWeight = true, PriceCents representa o preço por KG em centavos.
    /// </summary>
    [MaxLength(5)]
    public string? ScaleProductCode { get; set; }

    /// <summary>
    /// Como o valor VVVVV do barcode deve ser interpretado.
    /// WeightEncoded (padrão): VVVVV = peso em gramas → preço total = peso × (PriceCents/100)
    /// PriceEncoded: VVVVV = preço total em centavos → quantidade = 1
    /// </summary>
    public ScaleBarcodeMode ScaleBarcodeMode { get; set; } = ScaleBarcodeMode.WeightEncoded;

    /// <summary>Tara da embalagem em gramas (descontada automaticamente do peso bruto). Padrão 0.</summary>
    [Column(TypeName = "decimal(8,3)")]
    public decimal ScaleTareWeight { get; set; } = 0;

    // ── Imagem legada (mantida para compatibilidade com OrderItem) ──
    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    // ── Promoção / Destaque ───────────────────────────────────
    /// <summary>Aparece na seção "Destaques do Dia" no catálogo.</summary>
    public bool IsFeatured { get; set; } = false;

    /// <summary>Aparece na seção "Mais Vendidos" no catálogo.</summary>
    public bool IsBestSeller { get; set; } = false;

    /// <summary>Percentual de desconto exibido no card (0–100). Null = sem desconto.</summary>
    public int? DiscountPercent { get; set; }

    // ── Status ───────────────────────────────────────────────
    public bool IsActive { get; set; } = true;

    // ── Timestamps ───────────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // ── Concorrência (desabilitada — xmin causava DbUpdateConcurrencyException nos seeds) ─
    public byte[]? RowVersion { get; set; }

    // ── Adicionais ────────────────────────────────────────────
    /// <summary>Produto possui adicionais opcionais selecionáveis no PDV.</summary>
    public bool HasAddons { get; set; } = false;

    // ── Insumo ────────────────────────────────────────────────
    /// <summary>Produto é um insumo interno (não aparece no catálogo público).</summary>
    public bool IsSupply { get; set; } = false;

    // ── Navegações ────────────────────────────────────────────
    public List<ProductVariant> Variants { get; set; } = new();
    public List<ProductImage> Images { get; set; } = new();
    public List<Petshop.Api.Entities.Catalog.ProductAddon> Addons { get; set; } = new();
    public List<Petshop.Api.Entities.Catalog.ProductAddonGroup> AddonGroups { get; set; } = new();
}
