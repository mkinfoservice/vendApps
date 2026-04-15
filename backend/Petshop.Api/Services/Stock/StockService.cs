using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Entities.Stock;

namespace Petshop.Api.Services.Stock;

/// <summary>
/// Gerencia movimentações de estoque.
/// Atualiza Product.StockQty via SQL direto (sem EF tracking) para evitar
/// DbUpdateConcurrencyException causada pelo xmin shadow property do Npgsql.
/// Os StockMovements são adicionados ao tracker e salvos pelo caller.
/// </summary>
public class StockService
{
    private readonly AppDbContext           _db;
    private readonly ILogger<StockService> _logger;

    public StockService(AppDbContext db, ILogger<StockService> logger)
    {
        _db     = db;
        _logger = logger;
    }

    /// <summary>
    /// Debita o estoque de todos os itens de uma venda concluída.
    /// Usa SQL direto para o UPDATE do produto (sem EF tracking),
    /// e registra cada movimento no ledger StockMovement via EF tracker.
    /// Deve ser chamado dentro de uma transação explícita iniciada pelo caller.
    /// </summary>
    public async Task DecrementOnSaleAsync(SaleOrder sale, string actorName, CancellationToken ct)
    {
        var productIds = sale.Items.Select(i => i.ProductId).Distinct().ToList();

        // AsNoTracking: carrega apenas para ler StockQty atual — não rastreia no EF
        var products = await _db.Products
            .AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == sale.CompanyId)
            .ToDictionaryAsync(p => p.Id, ct);

        var shortSaleId = sale.Id.ToString("N")[..8];
        var now         = DateTime.UtcNow;

        foreach (var item in sale.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product))
                continue;

            var qty = item.IsSoldByWeight
                ? (item.WeightKg ?? 0)
                : (decimal)item.Qty;

            if (qty <= 0) continue;

            var before = product.StockQty;
            var after  = before - qty;

            // UPDATE direto: sem EF tracking, sem concurrency check, dentro da transação do caller
            await _db.Database.ExecuteSqlAsync(
                $"""
                UPDATE "Products"
                SET    "StockQty"     = "StockQty" - {qty},
                       "UpdatedAtUtc" = {now}
                WHERE  "Id"        = {product.Id}
                  AND  "CompanyId" = {sale.CompanyId}
                """, ct);

            _db.StockMovements.Add(new StockMovement
            {
                CompanyId     = sale.CompanyId,
                ProductId     = product.Id,
                MovementType  = StockMovementType.SaleExit,
                Quantity      = -qty,
                BalanceBefore = before,
                BalanceAfter  = after,
                SaleOrderId   = sale.Id,
                ActorName     = actorName,
                Reason        = $"Venda PDV #{shortSaleId}",
            });
        }

        _logger.LogDebug("[Stock] Debitados {Count} itens da venda {SaleId}.", sale.Items.Count, sale.Id);
    }

    /// <summary>
    /// Debita automaticamente os insumos vinculados aos produtos vendidos.
    /// Para cada item da venda, carrega os ProductSupplyLinks do produto e
    /// decrementa Supply.StockQty via SQL direto dentro da mesma transação.
    /// Retorna os insumos cujo StockQty ficou ≤ MinQty (para disparar alertas fora da transação).
    /// </summary>
    public async Task<List<Supply>> DecrementSuppliesOnSaleAsync(SaleOrder sale, CancellationToken ct)
    {
        var productIds = sale.Items.Select(i => i.ProductId).Distinct().ToList();

        // Carrega todos os vínculos dos produtos desta venda de uma só query
        var links = await _db.ProductSupplyLinks
            .AsNoTracking()
            .Where(l => l.CompanyId == sale.CompanyId && productIds.Contains(l.ProductId))
            .Include(l => l.Supply)
            .ToListAsync(ct);

        if (links.Count == 0) return [];

        var now           = DateTime.UtcNow;
        var supplyDeltas  = new Dictionary<Guid, decimal>(); // supplyId → total debitado

        // Acumula consumo por insumo (um produto pode estar em múltiplos itens)
        foreach (var item in sale.Items)
        {
            var qty = item.IsSoldByWeight
                ? (item.WeightKg ?? 0)
                : (decimal)item.Qty;

            if (qty <= 0) continue;

            foreach (var link in links.Where(l => l.ProductId == item.ProductId))
            {
                var consumed = link.QuantityPerUnit * qty;
                supplyDeltas.TryAdd(link.SupplyId, 0);
                supplyDeltas[link.SupplyId] += consumed;
            }
        }

        if (supplyDeltas.Count == 0) return [];

        // Debita cada insumo via SQL direto dentro da transação do caller
        foreach (var (supplyId, delta) in supplyDeltas)
        {
            await _db.Database.ExecuteSqlAsync(
                $"""
                UPDATE "Supplies"
                SET    "StockQty"     = "StockQty" - {delta},
                       "UpdatedAtUtc" = {now}
                WHERE  "Id"        = {supplyId}
                  AND  "CompanyId" = {sale.CompanyId}
                """, ct);
        }

        // Recarrega os insumos para verificar quais ficaram abaixo do mínimo
        var supplyIds = supplyDeltas.Keys.ToList();
        var updatedSupplies = await _db.Supplies
            .AsNoTracking()
            .Where(s => supplyIds.Contains(s.Id) && s.CompanyId == sale.CompanyId)
            .ToListAsync(ct);

        var lowSupplies = updatedSupplies
            .Where(s => s.MinQty > 0 && s.StockQty <= s.MinQty)
            .ToList();

        _logger.LogDebug(
            "[Stock] Debitados {Count} insumo(s) da venda {SaleId}. {Low} abaixo do mínimo.",
            supplyDeltas.Count, sale.Id, lowSupplies.Count);

        return lowSupplies;
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
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Produto não encontrado.");

        var before = product.StockQty;
        var after  = before + delta;
        var now    = DateTime.UtcNow;

        await _db.Database.ExecuteSqlAsync(
            $"""
            UPDATE "Products"
            SET    "StockQty"     = "StockQty" + {delta},
                   "UpdatedAtUtc" = {now}
            WHERE  "Id"        = {productId}
              AND  "CompanyId" = {companyId}
            """, ct);

        var movement = new StockMovement
        {
            CompanyId     = companyId,
            ProductId     = productId,
            MovementType  = type,
            Quantity      = delta,
            BalanceBefore = before,
            BalanceAfter  = after,
            Reason        = reason,
            ActorName     = actorName,
        };
        _db.StockMovements.Add(movement);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Stock] Ajuste manual: Produto {ProductId} | {Before} → {After} | {Type} | {Actor}",
            productId, before, after, type, actorName);

        return movement;
    }
}
