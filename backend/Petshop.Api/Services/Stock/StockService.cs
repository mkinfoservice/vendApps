using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Entities.Stock;

namespace Petshop.Api.Services.Stock;

/// <summary>
/// Gerencia movimentações de estoque.
/// Atualiza Product.StockQty atomicamente e registra cada movimento no ledger StockMovement.
/// </summary>
public class StockService
{
    private readonly AppDbContext              _db;
    private readonly ILogger<StockService>    _logger;

    public StockService(AppDbContext db, ILogger<StockService> logger)
    {
        _db     = db;
        _logger = logger;
    }

    /// <summary>
    /// Debita o estoque de todos os itens de uma venda concluída.
    /// Chamado dentro do mesmo SaveChangesAsync do Pay() para garantir atomicidade.
    /// </summary>
    public async Task DecrementOnSaleAsync(SaleOrder sale, string actorName, CancellationToken ct)
    {
        var productIds = sale.Items.Select(i => i.ProductId).Distinct().ToList();

        // Carrega produtos com bloqueio otimista via RowVersion
        var products = await _db.Products
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == sale.CompanyId)
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var item in sale.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product))
                continue;

            var qty = item.IsSoldByWeight
                ? (item.WeightKg ?? 0)
                : (decimal)item.Qty;

            if (qty <= 0) continue;

            var before = product.StockQty;
            product.StockQty  -= qty;
            product.UpdatedAtUtc = DateTime.UtcNow;

            _db.StockMovements.Add(new StockMovement
            {
                CompanyId     = sale.CompanyId,
                ProductId     = product.Id,
                MovementType  = StockMovementType.SaleExit,
                Quantity      = -qty,
                BalanceBefore = before,
                BalanceAfter  = product.StockQty,
                SaleOrderId   = sale.Id,
                ActorName     = actorName,
                Reason        = $"Venda PDV #{sale.Id:N8}",
            });
        }

        _logger.LogDebug("[Stock] Debitados {Count} itens da venda {SaleId}.", sale.Items.Count, sale.Id);
    }

    /// <summary>Ajuste manual de estoque (entrada, saída, perda, devolução, etc.).</summary>
    public async Task<StockMovement> AdjustAsync(
        Guid companyId,
        Guid productId,
        decimal delta,
        StockMovementType type,
        string? reason,
        string actorName,
        CancellationToken ct)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Produto não encontrado.");

        var before = product.StockQty;
        product.StockQty     += delta;
        product.UpdatedAtUtc  = DateTime.UtcNow;

        var movement = new StockMovement
        {
            CompanyId     = companyId,
            ProductId     = productId,
            MovementType  = type,
            Quantity      = delta,
            BalanceBefore = before,
            BalanceAfter  = product.StockQty,
            Reason        = reason,
            ActorName     = actorName,
        };
        _db.StockMovements.Add(movement);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Stock] Ajuste manual: Produto {ProductId} | {Before} → {After} | {Type} | {Actor}",
            productId, before, product.StockQty, type, actorName);

        return movement;
    }
}
