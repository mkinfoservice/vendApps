using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Marketplace;

/// <summary>
/// Vincula um pedido interno (Order) ao pedido correspondente no marketplace.
/// Usado para deduplicação, rastreamento de status e callback.
/// </summary>
public class MarketplaceOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid MarketplaceIntegrationId { get; set; }
    public MarketplaceIntegration? Integration { get; set; }

    /// <summary>FK para o Order interno criado a partir deste pedido.</summary>
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    /// <summary>ID do pedido no marketplace (ex: iFood orderId UUID).</summary>
    [MaxLength(100)]
    public string ExternalOrderId { get; set; } = "";

    /// <summary>Status raw devolvido pelo marketplace (para diagnóstico).</summary>
    [MaxLength(60)]
    public string ExternalStatus { get; set; } = "";

    /// <summary>Último status interno enviado de volta para o marketplace.</summary>
    [MaxLength(60)]
    public string? LastCallbackStatus { get; set; }

    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastCallbackAtUtc { get; set; }

    /// <summary>Payload original recebido do marketplace (para reprocessamento / debug).</summary>
    public string RawPayloadJson { get; set; } = "{}";
}
