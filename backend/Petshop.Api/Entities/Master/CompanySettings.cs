using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Master;

/// <summary>
/// Configurações operacionais de uma empresa (1:1 com Company).
/// Criada pelo wizard de provisionamento do Master Admin.
/// </summary>
public class CompanySettings
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Depósito / Origem das entregas ───────────────────
    public double? DepotLatitude { get; set; }
    public double? DepotLongitude { get; set; }

    [MaxLength(300)]
    public string? DepotAddress { get; set; }

    // ── Cobertura de entrega ──────────────────────────────
    public double? CoverageRadiusKm { get; set; }
    public string? CoveragePolygonGeoJson { get; set; }   // GeoJSON futuro
    public string? BlockedZonesGeoJson { get; set; }      // FeatureCollection

    // ── Taxas ────────────────────────────────────────────
    public int? DeliveryFixedCents { get; set; }
    public int? DeliveryPerKmCents { get; set; }
    public int? MinOrderCents { get; set; }

    // ── Métodos de pagamento ──────────────────────────────
    public bool EnablePix { get; set; } = true;
    public bool EnableCard { get; set; } = true;
    public bool EnableCash { get; set; } = true;

    [MaxLength(100)]
    public string? PixKey { get; set; }

    // ── Impressão ────────────────────────────────────────
    public bool PrintEnabled { get; set; } = false;

    [MaxLength(20)]
    public string? PrintLayout { get; set; }  // "A4" | "80mm"

    // ── WhatsApp (link de checkout) ───────────────────────
    /// <summary>
    /// Número E.164 para links de checkout (ex: 5521992329239).
    /// Nível 1 do WhatsApp — substitui o número hardcoded no frontend.
    /// </summary>
    [MaxLength(20)]
    public string? SupportWhatsappE164 { get; set; }

    // ── Timestamps ───────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
