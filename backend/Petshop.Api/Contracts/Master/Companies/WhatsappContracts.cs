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

    /// <summary>JSON objeto status→template. Ex: {"RECEBIDO":"pedido_recebido"}</summary>
    string? NotificationTemplatesJson,

    /// <summary>Código de idioma dos templates. Ex: "pt_BR"</summary>
    string  TemplateLanguageCode,

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

    /// <summary>
    /// JSON objeto mapeando status → nome do template aprovado na Meta.
    /// Ex: {"RECEBIDO":"pedido_recebido","SAIU_PARA_ENTREGA":"pedido_saiu","ENTREGUE":"pedido_entregue"}
    /// </summary>
    string? NotificationTemplatesJson,

    /// <summary>Código de idioma dos templates. Padrão: "pt_BR"</summary>
    string? TemplateLanguageCode,

    bool? IsActive
);
