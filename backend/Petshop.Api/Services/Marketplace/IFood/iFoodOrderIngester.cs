using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Marketplace;
using Petshop.Api.Services.Print;

namespace Petshop.Api.Services.Marketplace.IFood;

/// <summary>
/// Processa o payload de evento webhook do iFood:
///  1. Busca o pedido completo na API do iFood
///  2. Normaliza para Order interno
///  3. Cria MarketplaceOrder (vínculo + rastreamento)
///  4. Dispara impressão automática se configurado
/// </summary>
public class iFoodOrderIngester : IMarketplaceOrderIngester
{
    public MarketplaceType Type => MarketplaceType.IFood;

    private readonly AppDbContext _db;
    private readonly iFoodAuthService _auth;
    private readonly IHttpClientFactory _http;
    private readonly PrintService _print;
    private readonly ILogger<iFoodOrderIngester> _logger;

    private const string BaseUrl = "https://merchant-api.ifood.com.br";

    public iFoodOrderIngester(
        AppDbContext db,
        iFoodAuthService auth,
        IHttpClientFactory http,
        PrintService print,
        ILogger<iFoodOrderIngester> logger)
    {
        _db = db;
        _auth = auth;
        _http = http;
        _print = print;
        _logger = logger;
    }

    public async Task<IngestResult> IngestAsync(
        string rawPayload,
        string? signature,
        MarketplaceIntegration integration,
        CancellationToken ct = default)
    {
        // 1. Deserializa o evento webhook (envelope externo)
        iFoodWebhookEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<iFoodWebhookEvent>(rawPayload,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[iFood] Falha ao deserializar evento webhook.");
            return IngestResult.Fail("Payload inválido");
        }

        if (evt is null || string.IsNullOrEmpty(evt.OrderId))
        {
            _logger.LogWarning("[iFood] Evento sem orderId. Payload={P}", rawPayload);
            return IngestResult.Fail("OrderId ausente no evento");
        }

        // Só processa PLACED (novo pedido) — outros eventos (CFM, CAN) são tratados em callbacks
        if (evt.Code != "PLC" && evt.FullCode != "PLACED")
        {
            _logger.LogInformation("[iFood] Evento ignorado (não é PLACED). Code={C}", evt.Code);
            return IngestResult.Duplicate(); // retorna sucesso sem processar
        }

        // 2. Deduplicação — já processamos este pedido?
        var exists = await _db.MarketplaceOrders
            .AnyAsync(mo => mo.MarketplaceIntegrationId == integration.Id
                         && mo.ExternalOrderId == evt.OrderId, ct);
        if (exists)
        {
            _logger.LogInformation("[iFood] Pedido duplicado ignorado. ExternalId={Id}", evt.OrderId);
            return IngestResult.Duplicate();
        }

        // 3. Busca pedido completo na API do iFood
        iFoodOrderPayload? payload;
        try
        {
            payload = await FetchOrderAsync(integration, evt.OrderId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[iFood] Falha ao buscar pedido {Id} na API.", evt.OrderId);
            return IngestResult.Fail($"Erro ao buscar pedido: {ex.Message}");
        }

        if (payload is null)
            return IngestResult.Fail("Pedido não encontrado na API do iFood");

        // 4. Mapeia para Order interno
        var order = MapToOrder(payload, integration);
        _db.Orders.Add(order);

        // 5. Cria vínculo MarketplaceOrder
        var mktOrder = new MarketplaceOrder
        {
            MarketplaceIntegrationId = integration.Id,
            OrderId = order.Id,
            ExternalOrderId = evt.OrderId,
            ExternalStatus = evt.Code,
            ReceivedAtUtc = DateTime.UtcNow,
            RawPayloadJson = rawPayload,
        };
        _db.MarketplaceOrders.Add(mktOrder);

        // 6. Atualiza timestamp da última recepção
        integration.LastOrderReceivedAtUtc = DateTime.UtcNow;
        integration.LastErrorMessage = null;

        await _db.SaveChangesAsync(ct);

        // 7. Impressão automática
        if (integration.AutoPrint)
        {
            try { await _print.EnqueueAsync(order, ct); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[iFood] Falha na impressão automática do pedido {Id}.", order.PublicId);
            }
        }

        _logger.LogInformation("[iFood] Pedido ingested. External={Ext} Internal={Int}",
            evt.OrderId, order.PublicId);

        return IngestResult.Ok(order.Id.ToString());
    }

    // ── Busca pedido completo na API ──────────────────────────────────────────

    private async Task<iFoodOrderPayload?> FetchOrderAsync(
        MarketplaceIntegration integration,
        string externalOrderId,
        CancellationToken ct)
    {
        var token = await _auth.GetTokenAsync(integration, ct);
        using var client = _http.CreateClient("ifood");
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var url = $"{BaseUrl}/order/v1.0/orders/{externalOrderId}";
        var response = await client.GetAsync(url, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _auth.Invalidate(integration.Id);
            token = await _auth.GetTokenAsync(integration, ct);
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            response = await client.GetAsync(url, ct);
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[iFood] GET order/{Id} retornou {Status}", externalOrderId, response.StatusCode);
            return null;
        }

        return await response.Content.ReadFromJsonAsync<iFoodOrderPayload>(cancellationToken: ct);
    }

    // ── Mapeamento iFood → Order interno ─────────────────────────────────────

    private Order MapToOrder(iFoodOrderPayload p, MarketplaceIntegration integration)
    {
        var addr = p.Delivery?.DeliveryAddress;
        var payMethod = NormalizePaymentMethod(p.Payments);
        var cashGiven  = GetCashGiven(p.Payments);

        var subtotalCents  = ToСents(p.Total?.SubTotal ?? 0);
        var deliveryCents  = ToСents(p.Total?.DeliveryFee ?? 0);
        var totalCents     = ToСents(p.Total?.OrderAmount ?? 0);

        var order = new Order
        {
            Id            = Guid.NewGuid(),
            CompanyId     = integration.CompanyId,
            PublicId      = OrderIdGenerator.NewPublicId(),
            CustomerName  = p.Customer?.Name ?? "Cliente iFood",
            Phone         = p.Customer?.Phone ?? "",
            Address       = addr != null
                ? $"{addr.StreetName}, {addr.StreetNumber}{(string.IsNullOrEmpty(addr.Complement) ? "" : " - " + addr.Complement)}"
                : "",
            Complement    = addr?.Complement,
            Cep           = addr?.PostalCode?.Replace("-", "") ?? "",
            Latitude      = addr?.Latitude.HasValue == true ? (double?)Convert.ToDouble(addr.Latitude.Value) : null,
            Longitude     = addr?.Longitude.HasValue == true ? (double?)Convert.ToDouble(addr.Longitude.Value) : null,
            PaymentMethod = payMethod,
            CashGivenCents = cashGiven,
            SubtotalCents  = subtotalCents,
            DeliveryCents  = deliveryCents,
            TotalCents     = totalCents,
            Status         = OrderStatus.RECEBIDO,
            CreatedAtUtc   = p.CreatedAt,
            UpdatedAtUtc   = DateTime.UtcNow,
        };

        foreach (var item in p.Items)
        {
            order.Items.Add(new OrderItem
            {
                Id                      = Guid.NewGuid(),
                OrderId                 = order.Id,
                ProductNameSnapshot     = item.Name,
                UnitPriceCentsSnapshot  = ToСents(item.UnitPrice?.Value ?? 0),
                Qty                     = item.Quantity,
            });
        }

        return order;
    }

    private static int ToСents(decimal value) => (int)Math.Round(value * 100);

    private static string NormalizePaymentMethod(iFoodPayments? payments)
    {
        var method = payments?.Methods?.FirstOrDefault();
        if (method is null) return "PIX";

        return method.Method.ToUpperInvariant() switch
        {
            "CREDIT" or "CREDIT_CARD"  => "CARTAO_CREDITO",
            "DEBIT"  or "DEBIT_CARD"   => "CARTAO_DEBITO",
            "CASH"   or "DINHEIRO"     => "DINHEIRO",
            "PIX"                      => "PIX",
            _                          => "PIX",
        };
    }

    private static int? GetCashGiven(iFoodPayments? payments)
    {
        var cash = payments?.Methods?.FirstOrDefault(m =>
            m.Method.Equals("CASH", StringComparison.OrdinalIgnoreCase) ||
            m.Method.Equals("DINHEIRO", StringComparison.OrdinalIgnoreCase));

        if (cash?.Cash?.ChangeFor is { } changeFor && changeFor > 0)
            return ToСents(changeFor);

        return null;
    }
}
