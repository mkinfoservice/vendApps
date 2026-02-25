namespace Petshop.Api.Contracts.Master.Companies;

// ── Response ──────────────────────────────────────────────────

public record WhatsappIntegrationDto(
    Guid   Id,
    Guid   CompanyId,

    /// <summary>"link" | "cloud_api"</summary>
    string Mode,

    // Cloud API (preenchido somente quando Mode=cloud_api)
    string? WabaId,
    string? PhoneNumberId,

    /// <summary>true se token está armazenado — o valor nunca é retornado.</summary>
    bool    HasAccessToken,

    string? WebhookSecret,

    /// <summary>JSON array string com os status que disparam notificação. Ex: ["RECEBIDO","EM_PREPARO"]</summary>
    string? NotifyOnStatuses,

    bool     IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);

// ── Upsert (cria ou atualiza) ──────────────────────────────────

public record UpsertWhatsappRequest(
    /// <summary>"link" | "cloud_api"</summary>
    string Mode,

    string? WabaId,
    string? PhoneNumberId,

    /// <summary>Token em texto plano — criptografado server-side. null = mantém o token existente.</summary>
    string? AccessToken,

    string? WebhookSecret,

    /// <summary>JSON array string. Ex: "[\"RECEBIDO\",\"EM_PREPARO\"]"</summary>
    string? NotifyOnStatuses,

    bool? IsActive
);
