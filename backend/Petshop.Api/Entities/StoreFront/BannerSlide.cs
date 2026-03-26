using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.StoreFront;

/// <summary>
/// Slide individual do banner rotativo da loja.
/// CTA (Call to Action) = botão opcional que redireciona o cliente.
/// </summary>
public class BannerSlide
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid StoreFrontConfigId { get; set; }
    public StoreFrontConfig StoreFrontConfig { get; set; } = default!;

    // ── Conteúdo ──────────────────────────────────────────────────────────────
    /// <summary>URL https:// ou data URI base64 (imagem carregada pelo admin).</summary>
    public string? ImageUrl { get; set; }

    [MaxLength(120)]
    public string? Title { get; set; }

    [MaxLength(200)]
    public string? Subtitle { get; set; }

    // ── CTA (Call to Action) ──────────────────────────────────────────────────
    /// <summary>Texto do botão (máx 60 chars para caber no mobile).</summary>
    [MaxLength(60)]
    public string? CtaText { get; set; }

    /// <summary>Tipo de destino: "none" | "category" | "product" | "external".</summary>
    [MaxLength(20)]
    public string CtaType { get; set; } = "none";

    /// <summary>
    /// Valor dependente de CtaType:
    /// - category → slug da categoria
    /// - product  → id do produto (Guid como string)
    /// - external → URL completa
    /// </summary>
    [MaxLength(500)]
    public string? CtaTarget { get; set; }

    /// <summary>Abrir link em nova aba (relevante apenas para CtaType=external).</summary>
    public bool CtaNewTab { get; set; } = false;

    // ── Ordenação / visibilidade ──────────────────────────────────────────────
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
