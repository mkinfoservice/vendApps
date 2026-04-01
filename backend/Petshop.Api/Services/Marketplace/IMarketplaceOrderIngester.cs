using Petshop.Api.Entities.Marketplace;
using Petshop.Api.Entities;

namespace Petshop.Api.Services.Marketplace;

/// <summary>
/// Resultado do processamento de um pedido recebido do marketplace.
/// </summary>
public record IngestResult(
    bool Success,
    string? InternalOrderId = null,
    string? ErrorMessage = null)
{
    public static IngestResult Ok(string orderId) => new(true, orderId);
    public static IngestResult Fail(string reason) => new(false, null, reason);
    public static IngestResult Duplicate() => new(true, null); // já processado, ignorar
}

/// <summary>
/// Contrato que cada integração de marketplace deve implementar para
/// normalizar o payload recebido e criar/atualizar o Order interno.
/// </summary>
public interface IMarketplaceOrderIngester
{
    MarketplaceType Type { get; }

    Task<IngestResult> IngestAsync(
        string rawPayload,
        string? signature,
        MarketplaceIntegration integration,
        CancellationToken ct = default);
}

/// <summary>
/// Contrato para enviar atualizações de status de volta ao marketplace.
/// </summary>
public interface IMarketplaceStatusCallback
{
    MarketplaceType Type { get; }

    Task PushStatusAsync(
        MarketplaceOrder marketplaceOrder,
        OrderStatus newStatus,
        CancellationToken ct = default);
}
