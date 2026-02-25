namespace Petshop.Api.Contracts.Master.Companies;

// ── Response ──────────────────────────────────────────────────

public record AdminUserDto(
    Guid     Id,
    Guid?    CompanyId,
    string   Username,
    string?  Email,
    string   Role,
    bool     IsActive,
    DateTime? LastLoginAtUtc,
    DateTime CreatedAtUtc
);

public record ListAdminUsersResponse(
    List<AdminUserDto> Items,
    int Total
);

// ── Criação ───────────────────────────────────────────────────

public record CreateAdminUserRequest(
    string  Username,
    string  Password,
    string? Email
);

// ── Reset de senha ────────────────────────────────────────────

public record ResetPasswordRequest(string NewPassword);
