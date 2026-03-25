using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Enrichment;

/// <summary>
/// Configuração de enriquecimento por empresa (1:1 com Company).
/// Criada com defaults seguros na primeira vez que a empresa acessa o módulo.
/// </summary>
public class EnrichmentConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Thresholds de confiança ───────────────────────────────────────────────
    /// <summary>Score mínimo para aplicar imagem automaticamente (padrão: 0.80).</summary>
    public decimal AutoApplyImageThreshold { get; set; } = 0.80m;

    /// <summary>Score mínimo para enviar imagem para revisão manual (padrão: 0.40).</summary>
    public decimal ReviewImageThreshold { get; set; } = 0.40m;

    /// <summary>Score mínimo para aplicar nome automaticamente (padrão: 0.70 = aplica quase tudo).</summary>
    public decimal AutoApplyNameThreshold { get; set; } = 0.70m;

    // ── Controles de processamento ────────────────────────────────────────────
    /// <summary>Número de produtos processados por vez no job (padrão: 50).</summary>
    public int BatchSize { get; set; } = 50;

    /// <summary>Delay em ms entre itens no job de imagem, para não estourar rate limit (padrão: 500ms).</summary>
    public int DelayBetweenItemsMs { get; set; } = 500;

    // ── Feature flags ─────────────────────────────────────────────────────────
    /// <summary>Habilita matching de imagem via APIs externas (padrão: true).</summary>
    public bool EnableImageMatching { get; set; } = true;

    /// <summary>Habilita normalização automática de nomes (padrão: true).</summary>
    public bool EnableNameNormalization { get; set; } = true;

    public DateTime? UpdatedAtUtc { get; set; }
}
