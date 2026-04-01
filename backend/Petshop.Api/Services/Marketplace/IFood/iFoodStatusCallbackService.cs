using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Marketplace;

namespace Petshop.Api.Services.Marketplace.IFood;

/// <summary>
/// Envia atualizações de status de pedido de volta ao iFood.
/// Chamado automaticamente sempre que OrderStatus muda para um pedido
/// que possui um MarketplaceOrder vinculado.
/// </summary>
public class iFoodStatusCallbackService : IMarketplaceStatusCallback
{
    public MarketplaceType Type => MarketplaceType.IFood;

    private readonly AppDbContext _db;
    private readonly iFoodAuthService _auth;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<iFoodStatusCallbackService> _logger;

    private const string BaseUrl = "https://merchant-api.ifood.com.br";

    // Mapeamento OrderStatus interno → ação iFood
    private static readonly Dictionary<OrderStatus, string?> StatusMap = new()
    {
        [OrderStatus.RECEBIDO]             = null,                // não notifica (já foi confirmado pelo PLACED)
        [OrderStatus.EM_PREPARO]           = "confirm",           // CFM — aceita o pedido
        [OrderStatus.PRONTO_PARA_ENTREGA]  = "readyToPickup",     // RTP — pronto para retirada
        [OrderStatus.SAIU_PARA_ENTREGA]    = "dispatch",          // DSP — saiu para entrega
        [OrderStatus.ENTREGUE]             = "delivered",         // DEL — entregue
        [OrderStatus.CANCELADO]            = "requestCancellation",
    };

    public iFoodStatusCallbackService(
        AppDbContext db,
        iFoodAuthService auth,
        IHttpClientFactory http,
        ILogger<iFoodStatusCallbackService> logger)
    {
        _db    = db;
        _auth  = auth;
        _http  = http;
        _logger = logger;
    }

    public async Task PushStatusAsync(
        MarketplaceOrder marketplaceOrder,
        OrderStatus newStatus,
        CancellationToken ct = default)
    {
        if (!StatusMap.TryGetValue(newStatus, out var action) || action is null)
        {
            _logger.LogDebug("[iFood] Status {S} não requer callback.", newStatus);
            return;
        }

        var integration = await _db.MarketplaceIntegrations
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == marketplaceOrder.MarketplaceIntegrationId, ct);

        if (integration is null || !integration.IsActive)
        {
            _logger.LogWarning("[iFood] Integração não encontrada ou inativa. Id={Id}",
                marketplaceOrder.MarketplaceIntegrationId);
            return;
        }

        try
        {
            await SendActionAsync(integration, marketplaceOrder.ExternalOrderId, action, ct);

            marketplaceOrder.LastCallbackStatus = newStatus.ToString();
            marketplaceOrder.LastCallbackAtUtc  = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("[iFood] Callback enviado. ExternalId={Id} Action={A}",
                marketplaceOrder.ExternalOrderId, action);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[iFood] Falha ao enviar callback. ExternalId={Id} Action={A}",
                marketplaceOrder.ExternalOrderId, action);

            integration.LastErrorMessage = ex.Message;
            await _db.SaveChangesAsync(ct);
        }
    }

    private async Task SendActionAsync(
        MarketplaceIntegration integration,
        string externalOrderId,
        string action,
        CancellationToken ct)
    {
        var token = await _auth.GetTokenAsync(integration, ct);
        using var client = _http.CreateClient("ifood");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var url = $"{BaseUrl}/order/v1.0/orders/{externalOrderId}/{action}";
        var content = new StringContent("{}", Encoding.UTF8, "application/json");

        var response = await client.PostAsync(url, content, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _auth.Invalidate(integration.Id);
            token = await _auth.GetTokenAsync(integration, ct);
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            response = await client.PostAsync(url, content, ct);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"iFood retornou {response.StatusCode} para ação {action}: {body}");
        }
    }
}
