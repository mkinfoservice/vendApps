using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Purchases;
using Petshop.Api.Entities.Stock;
using Petshop.Api.Services.Stock;

namespace Petshop.Api.Services.Purchases;

/// <summary>
/// Processa o recebimento de uma ordem de compra:
/// marca como Received, credita estoque e opcionalmente atualiza custo médio do produto.
/// </summary>
public class PurchaseReceivingService
{
    private readonly AppDbContext              _db;
    private readonly StockService              _stock;
    private readonly ILogger<PurchaseReceivingService> _logger;

    public PurchaseReceivingService(AppDbContext db, StockService stock, ILogger<PurchaseReceivingService> logger)
    {
        _db     = db;
        _stock  = stock;
        _logger = logger;
    }

    /// <summary>
    /// Recebe todos os itens da ordem, credita estoque e atualiza custo médio.
    /// Lança InvalidOperationException se a ordem não estiver em Draft ou Confirmed.
    /// </summary>
    public async Task ReceiveAsync(Guid purchaseOrderId, Guid companyId, string actorName, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == purchaseOrderId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Ordem de compra não encontrada.");

        if (po.Status == PurchaseOrderStatus.Received)
            throw new InvalidOperationException("Ordem já foi recebida.");

        if (po.Status == PurchaseOrderStatus.Cancelled)
            throw new InvalidOperationException("Ordem cancelada não pode ser recebida.");

        var productIds = po.Items.Select(i => i.ProductId).Distinct().ToList();
        var products   = await _db.Products
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == companyId)
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var item in po.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product)) continue;

            var before = product.StockQty;
            product.StockQty    += item.Qty;
            product.CostCents    = item.UnitCostCents;   // custo FIFO — substitui pelo mais recente
            product.UpdatedAtUtc = DateTime.UtcNow;

            _db.StockMovements.Add(new StockMovement
            {
                CompanyId     = companyId,
                ProductId     = product.Id,
                MovementType  = StockMovementType.PurchaseEntry,
                Quantity      = item.Qty,
                BalanceBefore = before,
                BalanceAfter  = product.StockQty,
                UnitCostCents = item.UnitCostCents,
                SaleOrderId   = null,
                ActorName     = actorName,
                Reason        = $"Compra #{po.Id:N8}" + (po.InvoiceNumber != null ? $" NF {po.InvoiceNumber}" : ""),
            });
        }

        po.Status        = PurchaseOrderStatus.Received;
        po.ReceivedAtUtc = DateTime.UtcNow;
        po.UpdatedAtUtc  = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Purchases] PO {Id} recebida. {Count} itens creditados no estoque.", po.Id, po.Items.Count);
    }
}
