namespace Petshop.Api.Contracts.Master.Companies;

public record ProvisionCompanyRequest(
    // ── Admin da empresa (obrigatório) ───────────────────
    string AdminUsername,
    string AdminPassword,
    string? AdminEmail,

    // ── Settings básicas (opcionais) ─────────────────────
    string? SupportWhatsappE164,
    string? DepotAddress,
    double? DepotLatitude,
    double? DepotLongitude,
    int? DeliveryFixedCents,
    int? MinOrderCents,
    bool EnablePix = true,
    bool EnableCard = true,
    bool EnableCash = true,

    // ── Seed opcional ─────────────────────────────────────
    bool SeedCategories = false,
    bool SeedProducts = false,
    bool SeedDeliverer = false
);

public record ProvisionResultDto(
    Guid CompanyId,
    Guid AdminUserId,
    string AdminUsername,
    bool SettingsCreated,
    int SeededCategories,
    int SeededProducts,
    bool SeededDeliverer
);
