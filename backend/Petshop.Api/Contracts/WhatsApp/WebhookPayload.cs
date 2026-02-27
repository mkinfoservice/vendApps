using System.Text.Json.Serialization;

namespace Petshop.Api.Contracts.WhatsApp;

// ── Raiz do payload ───────────────────────────────────────────────────────────

public class WhatsAppWebhookPayload
{
    [JsonPropertyName("object")]
    public string Object { get; set; } = "";

    [JsonPropertyName("entry")]
    public List<WhatsAppEntry> Entry { get; set; } = [];
}

public class WhatsAppEntry
{
    /// <summary>WABA ID — usado para identificar a empresa no multi-tenant.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("changes")]
    public List<WhatsAppChange> Changes { get; set; } = [];
}

public class WhatsAppChange
{
    [JsonPropertyName("value")]
    public WhatsAppChangeValue Value { get; set; } = new();

    [JsonPropertyName("field")]
    public string Field { get; set; } = "";
}

// ── Value do change ───────────────────────────────────────────────────────────

public class WhatsAppChangeValue
{
    [JsonPropertyName("messaging_product")]
    public string MessagingProduct { get; set; } = "";

    [JsonPropertyName("metadata")]
    public WhatsAppMetadata? Metadata { get; set; }

    [JsonPropertyName("contacts")]
    public List<WhatsAppContactInfo>? Contacts { get; set; }

    [JsonPropertyName("messages")]
    public List<WhatsAppInboundMessage>? Messages { get; set; }

    [JsonPropertyName("statuses")]
    public List<WhatsAppStatusUpdate>? Statuses { get; set; }
}

public class WhatsAppMetadata
{
    [JsonPropertyName("display_phone_number")]
    public string DisplayPhoneNumber { get; set; } = "";

    [JsonPropertyName("phone_number_id")]
    public string PhoneNumberId { get; set; } = "";
}

// ── Mensagem recebida do cliente ──────────────────────────────────────────────

public class WhatsAppContactInfo
{
    [JsonPropertyName("profile")]
    public WhatsAppProfile? Profile { get; set; }

    [JsonPropertyName("wa_id")]
    public string WaId { get; set; } = "";
}

public class WhatsAppProfile
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";
}

public class WhatsAppInboundMessage
{
    /// <summary>ID único da mensagem (usado para idempotência).</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    /// <summary>Número do remetente em E.164 sem "+".</summary>
    [JsonPropertyName("from")]
    public string From { get; set; } = "";

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("text")]
    public WhatsAppTextContent? Text { get; set; }
}

public class WhatsAppTextContent
{
    [JsonPropertyName("body")]
    public string Body { get; set; } = "";
}

// ── Status de entrega (sent/delivered/read/failed) ────────────────────────────

public class WhatsAppStatusUpdate
{
    /// <summary>ID da mensagem original (wamid) — usado para idempotência.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    /// <summary>sent | delivered | read | failed</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = "";

    [JsonPropertyName("recipient_id")]
    public string RecipientId { get; set; } = "";
}
