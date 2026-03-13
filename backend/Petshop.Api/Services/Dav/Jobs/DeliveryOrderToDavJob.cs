using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Dav;

namespace Petshop.Api.Services.Dav.Jobs;

/// <summary>
/// Job Hangfire: quando um pedido de delivery é marcado como ENTREGUE,
/// cria automaticamente um SalesQuote (DAV) com status AwaitingFiscalConfirmation.
/// O job é idempotente — não cria DAV duplicado para o mesmo pedido.
/// </summary>
public class DeliveryOrderToDavJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<DeliveryOrderToDavJob> _logger;

    public DeliveryOrderToDavJob(AppDbContext db, ILogger<DeliveryOrderToDavJob> logger)
    {
        _db     = db;
        _logger = logger;
    }

    public async Task RunAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order is null)
        {
            _logger.LogWarning("DeliveryOrderToDavJob: pedido {OrderId} não encontrado.", orderId);
            return;
        }

        if (order.Status != OrderStatus.ENTREGUE)
        {
            _logger.LogWarning(
                "DeliveryOrderToDavJob: pedido {OrderId} não está ENTREGUE (status={Status}), abortando.",
                orderId, order.Status);
            return;
        }

        // Pedidos legados sem CompanyId não geram DAV
        if (order.CompanyId is null)
        {
            _logger.LogWarning(
                "DeliveryOrderToDavJob: pedido {OrderId} sem CompanyId, DAV não criado.", orderId);
            return;
        }

        // Idempotência: não duplicar DAV para o mesmo pedido
        var alreadyExists = await _db.SalesQuotes
            .AnyAsync(q => q.OriginOrderId == orderId, ct);

        if (alreadyExists)
        {
            _logger.LogInformation(
                "DeliveryOrderToDavJob: DAV já existe para pedido {OrderId}, ignorando.", orderId);
            return;
        }

        var items = order.Items.Select(i => new SalesQuoteItem
        {
            ProductId              = i.ProductId,
            ProductNameSnapshot    = i.ProductNameSnapshot,
            ProductBarcodeSnapshot = i.Product?.Barcode,
            Qty                    = i.Qty,
            UnitPriceCentsSnapshot = i.UnitPriceCentsSnapshot,
            TotalCents             = i.Qty * i.UnitPriceCentsSnapshot,
            IsSoldByWeight         = false // pedidos delivery não têm itens por peso ainda
        }).ToList();

        var subtotal = items.Sum(x => x.TotalCents);

        // Taxa de entrega não é desconto — o TotalCents do pedido inclui frete.
        // Registramos o total exato do pedido como TotalCents do DAV.
        var quote = new SalesQuote
        {
            CompanyId     = order.CompanyId.Value,
            PublicId      = DavPublicIdGenerator.NewPublicId(),
            Origin        = SalesQuoteOrigin.DeliveryOrder,
            OriginOrderId = order.Id,
            CustomerName  = order.CustomerName,
            CustomerPhone = order.Phone,
            PaymentMethod = order.PaymentMethod,
            SubtotalCents = subtotal,
            DiscountCents = 0,
            TotalCents    = order.TotalCents,
            Status        = SalesQuoteStatus.AwaitingFiscalConfirmation,
            Items         = items
        };

        _db.SalesQuotes.Add(quote);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "DeliveryOrderToDavJob: DAV {PublicId} criado para pedido {OrderPublicId} (empresa {CompanyId}).",
            quote.PublicId, order.PublicId, order.CompanyId);
    }
}
