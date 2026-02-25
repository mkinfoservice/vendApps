namespace Petshop.Api.Contracts.Master.Companies;

// ── Response ──────────────────────────────────────────────────

public record CompanySettingsDto(
    Guid   Id,
    Guid   CompanyId,

    // Depósito
    double? DepotLatitude,
    double? DepotLongitude,
    string? DepotAddress,

    // Cobertura
    double? CoverageRadiusKm,
    string? CoveragePolygonGeoJson,
    string? BlockedZonesGeoJson,

    // Taxas
    int? DeliveryFixedCents,
    int? DeliveryPerKmCents,
    int? MinOrderCents,

    // Pagamento
    bool    EnablePix,
    bool    EnableCard,
    bool    EnableCash,
    string? PixKey,

    // Impressão
    bool    PrintEnabled,
    string? PrintLayout,

    // WhatsApp
    string? SupportWhatsappE164,

    // Timestamps
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

// ── Atualização completa ───────────────────────────────────────

public record UpdateSettingsRequest(
    double? DepotLatitude,
    double? DepotLongitude,
    string? DepotAddress,

    double? CoverageRadiusKm,
    string? CoveragePolygonGeoJson,
    string? BlockedZonesGeoJson,

    int? DeliveryFixedCents,
    int? DeliveryPerKmCents,
    int? MinOrderCents,

    bool? EnablePix,
    bool? EnableCard,
    bool? EnableCash,
    string? PixKey,

    bool?   PrintEnabled,
    string? PrintLayout,

    string? SupportWhatsappE164
);

// ── Atualização parcial — Depósito ────────────────────────────

public record UpdateDepotRequest(
    double? Latitude,
    double? Longitude,
    string? Address
);

// ── Atualização parcial — Cobertura ───────────────────────────

public record UpdateCoverageRequest(
    double? RadiusKm,
    string? PolygonGeoJson,
    string? BlockedZonesGeoJson
);
