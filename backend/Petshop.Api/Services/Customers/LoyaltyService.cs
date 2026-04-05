using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Customers;
using Petshop.Api.Entities.Promotions;
using CustomerEntity = Petshop.Api.Entities.Customer;

namespace Petshop.Api.Services.Customers;

/// <summary>
/// Gerencia acúmulo e resgate de pontos de fidelidade.
/// </summary>
public class LoyaltyService
{
    private readonly AppDbContext _db;
    private readonly ILogger<LoyaltyService> _logger;

    public LoyaltyService(AppDbContext db, ILogger<LoyaltyService> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Config helpers ────────────────────────────────────────────────────────

    public async Task<LoyaltyConfig> GetOrCreateConfigAsync(Guid companyId, CancellationToken ct)
    {
        var cfg = await _db.LoyaltyConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, ct);

        if (cfg is null)
        {
            cfg = new LoyaltyConfig { CompanyId = companyId };
            _db.LoyaltyConfigs.Add(cfg);
            await _db.SaveChangesAsync(ct);
        }

        return cfg;
    }

    // ── Earn ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Acumula pontos para um cliente após uma venda.
    /// Retorna os pontos acumulados (pode ser 0 se fidelidade desativada).
    /// </summary>
    public async Task<int> EarnAsync(
        Guid companyId, Guid customerId, Guid saleOrderId, int totalCents, CancellationToken ct)
    {
        var cfg = await GetOrCreateConfigAsync(companyId, ct);
        if (!cfg.IsEnabled) return 0;

        var points = (int)Math.Floor(totalCents / 100m * cfg.PointsPerReal);
        if (points <= 0) return 0;

        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId && c.CompanyId == companyId, ct);
        if (customer is null) return 0;

        var before = customer.PointsBalance;
        customer.PointsBalance += points;
        customer.TotalSpentCents += totalCents;
        customer.TotalOrders++;
        customer.LastOrderUtc = DateTime.UtcNow;
        customer.UpdatedAtUtc = DateTime.UtcNow;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            CompanyId    = companyId,
            CustomerId   = customerId,
            SaleOrderId  = saleOrderId,
            Points       = points,
            BalanceBefore = before,
            BalanceAfter  = customer.PointsBalance,
            Description  = $"Acúmulo — venda {totalCents / 100m:C}",
        });

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Loyalty] +{Pts} pontos para cliente {Id}. Saldo: {Bal}.",
            points, customerId, customer.PointsBalance);

        return points;
    }

    // ── Earn (delivery order) ────────────────────────────────────────────────

    /// <summary>
    /// Acumula pontos para um cliente após um pedido de delivery/mesa ser entregue.
    /// </summary>
    public async Task<int> EarnForOrderAsync(Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order is null || order.CustomerId is null || order.CompanyId is null) return 0;

        var cfg = await GetOrCreateConfigAsync(order.CompanyId.Value, ct);
        if (!cfg.IsEnabled) return 0;

        var points = (int)Math.Floor(order.TotalCents / 100m * cfg.PointsPerReal);
        if (points <= 0) return 0;

        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId.Value && c.CompanyId == order.CompanyId.Value, ct);
        if (customer is null) return 0;

        var before = customer.PointsBalance;
        customer.PointsBalance   += points;
        customer.TotalSpentCents += order.TotalCents;
        customer.TotalOrders++;
        customer.LastOrderUtc = DateTime.UtcNow;
        customer.UpdatedAtUtc = DateTime.UtcNow;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            CompanyId     = order.CompanyId.Value,
            CustomerId    = order.CustomerId.Value,
            Points        = points,
            BalanceBefore = before,
            BalanceAfter  = customer.PointsBalance,
            Description   = $"Acúmulo — pedido {order.PublicId} {order.TotalCents / 100m:C}",
        });

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Loyalty] +{Pts} pontos para cliente {Id} (pedido {Pid}). Saldo: {Bal}.",
            points, order.CustomerId, order.PublicId, customer.PointsBalance);

        return points;
    }

    // ── Redeem ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Resgata pontos, retornando o valor de desconto em centavos.
    /// Lança InvalidOperationException se pontos insuficientes.
    /// </summary>
    public async Task<int> RedeemAsync(
        Guid companyId, Guid customerId, Guid saleOrderId, int pointsToRedeem, int orderTotalCents, CancellationToken ct)
    {
        var cfg = await GetOrCreateConfigAsync(companyId, ct);
        if (!cfg.IsEnabled) throw new InvalidOperationException("Programa de fidelidade desativado.");

        if (pointsToRedeem < cfg.MinRedemptionPoints)
            throw new InvalidOperationException($"Mínimo de {cfg.MinRedemptionPoints} pontos para resgate.");

        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId && c.CompanyId == companyId, ct);
        if (customer is null) throw new InvalidOperationException("Cliente não encontrado.");

        if (customer.PointsBalance < pointsToRedeem)
            throw new InvalidOperationException("Saldo de pontos insuficiente.");

        // Calcula desconto em centavos
        var discountCents = (int)Math.Floor(pointsToRedeem / (decimal)cfg.PointsPerReais * 100);

        // Aplica limite máximo de desconto por pedido
        var maxDiscountCents = (int)(orderTotalCents * cfg.MaxDiscountPercent / 100m);
        discountCents = Math.Min(discountCents, maxDiscountCents);

        var before = customer.PointsBalance;
        customer.PointsBalance -= pointsToRedeem;
        customer.UpdatedAtUtc  = DateTime.UtcNow;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            CompanyId     = companyId,
            CustomerId    = customerId,
            SaleOrderId   = saleOrderId,
            Points        = -pointsToRedeem,
            BalanceBefore = before,
            BalanceAfter  = customer.PointsBalance,
            Description   = $"Resgate — {pointsToRedeem} pts → desconto {discountCents / 100m:C}",
        });

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Loyalty] -{Pts} pontos resgatados para cliente {Id}. Desconto: {D}cts.",
            pointsToRedeem, customerId, discountCents);

        return discountCents;
    }

    /// <summary>
    /// Resgata uma recompensa baseada em promocao com custo em pontos.
    /// Opera em transacao com lock da linha do cliente para evitar saldo negativo em concorrencia.
    /// </summary>
    public async Task<RedeemPromotionResult> RedeemPromotionAsync(
        Guid companyId,
        Guid customerId,
        Guid promotionId,
        Guid requestId,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var promotion = await _db.Promotions
            .AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.Id == promotionId && p.IsActive)
            .FirstOrDefaultAsync(ct);

        if (promotion is null)
            throw new InvalidOperationException("Beneficio nao encontrado.");

        if (!IsPromotionActiveNow(promotion, now))
            throw new InvalidOperationException("Beneficio indisponivel no momento.");

        if (promotion.LoyaltyPointsCost is null || promotion.LoyaltyPointsCost <= 0)
            throw new InvalidOperationException("Beneficio nao configurado para resgate por pontos.");

        var existing = await _db.LoyaltyTransactions
            .AsNoTracking()
            .Where(t => t.CompanyId == companyId &&
                        t.CustomerId == customerId &&
                        t.Points < 0 &&
                        t.SaleOrderId == requestId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            return new RedeemPromotionResult(
                promotion.Id,
                promotion.Name,
                promotion.CouponCode,
                Math.Abs(existing.Points),
                existing.BalanceAfter,
                true);
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var customer = await _db.Customers
            .FromSqlInterpolated($@"SELECT * FROM ""Customers""
                                    WHERE ""Id"" = {customerId}
                                      AND ""CompanyId"" = {companyId}
                                    FOR UPDATE")
            .FirstOrDefaultAsync(ct);

        if (customer is null)
            throw new InvalidOperationException("Cliente nao encontrado.");

        var cost = promotion.LoyaltyPointsCost.Value;
        if (customer.PointsBalance < cost)
            throw new InvalidOperationException("Saldo de pontos insuficiente.");

        var before = customer.PointsBalance;
        customer.PointsBalance -= cost;
        customer.UpdatedAtUtc = now;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            CompanyId = companyId,
            CustomerId = customerId,
            SaleOrderId = requestId,
            Points = -cost,
            BalanceBefore = before,
            BalanceAfter = customer.PointsBalance,
            Description = $"Resgate beneficio [{promotion.Id}] cupom {promotion.CouponCode} ({promotion.Name})",
            CreatedAtUtc = now
        });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "[Loyalty] Beneficio resgatado. Cliente={CustomerId} Promo={PromotionId} Custo={Cost} Saldo={Balance}",
            customerId, promotionId, cost, customer.PointsBalance);

        return new RedeemPromotionResult(
            promotion.Id,
            promotion.Name,
            promotion.CouponCode,
            cost,
            customer.PointsBalance,
            false);
    }

    private static bool IsPromotionActiveNow(Promotion promotion, DateTime nowUtc)
    {
        if (promotion.StartsAtUtc.HasValue && promotion.StartsAtUtc.Value > nowUtc) return false;
        if (promotion.ExpiresAtUtc.HasValue && promotion.ExpiresAtUtc.Value < nowUtc) return false;
        return true;
    }

    // ── Manual adjustment ─────────────────────────────────────────────────────

    public async Task AdjustAsync(Guid companyId, Guid customerId, int points, string reason, CancellationToken ct)
    {
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId && c.CompanyId == companyId, ct);
        if (customer is null) throw new InvalidOperationException("Cliente não encontrado.");

        var before = customer.PointsBalance;
        customer.PointsBalance = Math.Max(0, customer.PointsBalance + points);
        customer.UpdatedAtUtc  = DateTime.UtcNow;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            CompanyId     = companyId,
            CustomerId    = customerId,
            Points        = points,
            BalanceBefore = before,
            BalanceAfter  = customer.PointsBalance,
            Description   = $"Ajuste manual: {reason}",
        });

        await _db.SaveChangesAsync(ct);
    }
}

public record RedeemPromotionResult(
    Guid PromotionId,
    string PromotionName,
    string? CouponCode,
    int PointsSpent,
    int PointsBalance,
    bool IsIdempotentReplay);
