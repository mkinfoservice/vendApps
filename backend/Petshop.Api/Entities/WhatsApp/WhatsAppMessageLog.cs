using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.WhatsApp;

/// <summary>
/// Log de cada mensagem WhatsApp enviada ou recebida.
/// Usado também para idempotência de notificações de pedido:
///   dedupe por (OrderId, TriggerStatus) impede duplo envio.
/// </summary>
public class WhatsAppMessageLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    /// <summary>"in" = mensagem recebida do cliente | "out" = mensagem enviada pelo sistema</summary>
    [MaxLength(3)]
    public string Direction { get; set; } = "out";

    /// <summary>ID da mensagem retornado pela Meta (wamid). Null para mensagens de entrada antes de logar o ack.</summary>
    [MaxLength(100)]
    public string? Wamid { get; set; }

    /// <summary>Número do cliente no formato E.164 sem "+".</summary>
    [MaxLength(20)]
    public string WaId { get; set; } = "";

    /// <summary>Pedido relacionado à mensagem (nullable).</summary>
    public Guid? OrderId { get; set; }

    /// <summary>Status do pedido que disparou esta mensagem (para idempotência).</summary>
    [MaxLength(40)]
    public string? TriggerStatus { get; set; }

    /// <summary>Payload completo da mensagem (JSON) para debugging.</summary>
    public string? PayloadJson { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
