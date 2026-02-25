namespace Petshop.Api.Contracts.Master.Companies;

// ── Listagem ──────────────────────────────────────────────────

public record CompanyListItemDto(
    Guid Id,
    string Name,
    string Slug,
    string Segment,
    string Plan,
    bool IsActive,
    bool IsDeleted,
    DateTime? SuspendedAtUtc,
    DateTime CreatedAtUtc,
    bool HasSettings,
    int AdminCount
);

public record ListCompaniesResponse(
    List<CompanyListItemDto> Items,
    int Total,
    int Page,
    int PageSize
);

// ── Detalhe ───────────────────────────────────────────────────

public record CompanyDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string Segment,
    string Plan,
    DateTime? PlanExpiresAtUtc,
    bool IsActive,
    bool IsDeleted,
    DateTime? SuspendedAtUtc,
    string? SuspendedReason,
    DateTime CreatedAtUtc,
    bool HasSettings,
    bool HasWhatsapp,
    int AdminCount
);

// ── Criação ───────────────────────────────────────────────────

public record CreateCompanyRequest(
    string Name,
    string Slug,
    string? Segment,
    string? Plan
);

// ── Atualização ───────────────────────────────────────────────

public record UpdateCompanyRequest(
    string? Name,
    string? Segment,
    string? Plan,
    DateTime? PlanExpiresAtUtc
);

// ── Suspensão ─────────────────────────────────────────────────

public record SuspendCompanyRequest(string? Reason);
