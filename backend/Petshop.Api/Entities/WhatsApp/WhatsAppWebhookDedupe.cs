using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.WhatsApp;

/// <summary>
/// Registro de eventos já processados do webhook da Meta.
/// Impede reprocessamento quando a Meta reenvia o mesmo evento.
/// EventId = messages[].id ou statuses[].id do payload.
/// </summary>
public class WhatsAppWebhookDedupe
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>ID único do evento (messages[].id ou statuses[].id).</summary>
    [MaxLength(100)]
    public string EventId { get; set; } = "";

    /// <summary>"message" | "status"</summary>
    [MaxLength(20)]
    public string EventType { get; set; } = "";

    public Guid? CompanyId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
