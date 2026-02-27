using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.WhatsApp;

/// <summary>
/// Vínculo entre um número de WhatsApp (wa_id) e uma empresa (tenant).
/// Mantém estado de conversa para o roteador de pós-venda.
/// </summary>
public class WhatsAppContact
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    /// <summary>Número no formato E.164 sem "+", ex: 5521999990000</summary>
    [MaxLength(20)]
    public string WaId { get; set; } = "";

    /// <summary>Nome retornado pelo perfil do WhatsApp (pode ser null)</summary>
    [MaxLength(120)]
    public string? ProfileName { get; set; }

    /// <summary>Estado atual da conversa para diálogos multi-turn.</summary>
    [MaxLength(50)]
    public string ConversationState { get; set; } = WhatsAppConversationState.Idle;

    public DateTime? LastInboundAtUtc { get; set; }
    public DateTime? LastOutboundAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Estados possíveis de conversa (pós-venda).</summary>
public static class WhatsAppConversationState
{
    public const string Idle        = "idle";
    public const string Tracking    = "tracking";
    public const string Return      = "return";
    public const string History     = "history";
    public const string HumanHandoff = "human_handoff";
}
