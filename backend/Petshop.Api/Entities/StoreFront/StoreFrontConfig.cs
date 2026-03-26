using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.StoreFront;

/// <summary>
/// Configuração visual da loja online — 1:1 com Company.
/// Criada automaticamente com defaults no primeiro acesso.
/// </summary>
public class StoreFrontConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Branding ──────────────────────────────────────────────────────────────
    /// <summary>URL ou data URI da logo da loja.</summary>
    public string? LogoUrl { get; set; }

    /// <summary>Nome da loja exibido no header.</summary>
    [MaxLength(120)]
    public string? StoreName { get; set; }

    /// <summary>Slogan / subtítulo exibido abaixo do nome.</summary>
    [MaxLength(200)]
    public string? StoreSlogan { get; set; }

    // ── Visual ────────────────────────────────────────────────────────────────
    /// <summary>Cor primária da marca em hexadecimal (ex: "#7c5cf8").</summary>
    [MaxLength(10)]
    public string PrimaryColor { get; set; } = "#7c5cf8";

    // ── Banner ────────────────────────────────────────────────────────────────
    /// <summary>Intervalo (segundos) entre slides. 0 = sem auto-rotação.</summary>
    public int BannerIntervalSecs { get; set; } = 5;

    public DateTime? UpdatedAtUtc { get; set; }

    // ── Navigation ────────────────────────────────────────────────────────────
    public ICollection<BannerSlide> BannerSlides { get; set; } = new List<BannerSlide>();
}
