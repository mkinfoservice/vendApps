using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Master;

/// <summary>
/// Integração WhatsApp de uma empresa (1:1 com Company).
/// Mode="link"     → usa SupportWhatsappE164 (CompanySettings) para links simples.
/// Mode="cloud_api" → usa WABA + PhoneNumberId para automações (futuro).
/// </summary>
public class CompanyIntegrationWhatsapp
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Modo ─────────────────────────────────────────────
    /// <summary>"link" | "cloud_api"</summary>
    [Required, MaxLength(20)]
    public string Mode { get; set; } = "link";

    // ── Cloud API (preenchido somente quando Mode=cloud_api) ──
    [MaxLength(50)]
    public string? WabaId { get; set; }

    [MaxLength(50)]
    public string? PhoneNumberId { get; set; }

    /// <summary>Token criptografado com AES-256. Nunca retornado nas respostas da API.</summary>
    public string? AccessTokenEncrypted { get; set; }

    [MaxLength(100)]
    public string? WebhookSecret { get; set; }

    /// <summary>JSON array com os status que disparam notificação. Ex: ["RECEBIDO","EM_PREPARO"]</summary>
    [MaxLength(500)]
    public string? NotifyOnStatuses { get; set; }

    /// <summary>
    /// JSON objeto mapeando status → nome do template aprovado na Meta.
    /// Ex: {"RECEBIDO":"pedido_recebido","SAIU_PARA_ENTREGA":"pedido_saiu","ENTREGUE":"pedido_entregue"}
    /// Quando preenchido para um status, usa template; caso contrário tenta texto livre
    /// (funciona apenas dentro da janela de 24h após o cliente ter enviado mensagem).
    /// </summary>
    public string? NotificationTemplatesJson { get; set; }

    /// <summary>Código de idioma dos templates aprovados. Padrão: "pt_BR"</summary>
    [MaxLength(10)]
    public string TemplateLanguageCode { get; set; } = "pt_BR";

    // ── Estado ───────────────────────────────────────────
    public bool IsActive { get; set; } = false;

    // ── Timestamps ───────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
