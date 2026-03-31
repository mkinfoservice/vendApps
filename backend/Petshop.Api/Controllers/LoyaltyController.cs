using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Customers;
using Petshop.Api.Services.Customers;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/loyalty")]
[Authorize(Roles = "admin,gerente,atendente")]
public class LoyaltyController : ControllerBase
{
    private readonly AppDbContext   _db;
    private readonly LoyaltyService _loyalty;

    public LoyaltyController(AppDbContext db, LoyaltyService loyalty)
    {
        _db      = db;
        _loyalty = loyalty;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/loyalty/config ──────────────────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);
        return Ok(cfg);
    }

    // ── PUT /admin/loyalty/config ──────────────────────────────────────────────
    [HttpPut("config")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> UpsertConfig([FromBody] UpsertLoyaltyConfigRequest req, CancellationToken ct)
    {
        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);

        if (req.IsEnabled.HasValue)         cfg.IsEnabled            = req.IsEnabled.Value;
        if (req.PointsPerReal.HasValue)      cfg.PointsPerReal         = req.PointsPerReal.Value;
        if (req.PointsPerReais.HasValue)     cfg.PointsPerReais        = req.PointsPerReais.Value;
        if (req.MinRedemptionPoints.HasValue) cfg.MinRedemptionPoints  = req.MinRedemptionPoints.Value;
        if (req.MaxDiscountPercent.HasValue)  cfg.MaxDiscountPercent   = req.MaxDiscountPercent.Value;

        cfg.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(cfg);
    }

    // ── GET /admin/loyalty/customers/{customerId} ─────────────────────────────
    [HttpGet("customers/{customerId:guid}")]
    public async Task<IActionResult> GetCustomerLoyalty(Guid customerId, CancellationToken ct)
    {
        var customer = await _db.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == customerId && c.CompanyId == CompanyId, ct);

        if (customer is null) return NotFound("Cliente não encontrado.");

        var transactions = await _db.LoyaltyTransactions
            .AsNoTracking()
            .Where(t => t.CustomerId == customerId && t.CompanyId == CompanyId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(50)
            .Select(t => new
            {
                t.Id,
                t.Points,
                t.BalanceBefore,
                t.BalanceAfter,
                t.Description,
                t.SaleOrderId,
                t.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);

        return Ok(new
        {
            customerId    = customer.Id,
            customerName  = customer.Name,
            customerPhone = customer.Phone,
            pointsBalance  = customer.PointsBalance,
            totalSpentCents = customer.TotalSpentCents,
            totalOrders    = customer.TotalOrders,
            lastOrderUtc   = customer.LastOrderUtc,
            discountValueCents = customer.PointsBalance > 0
                ? (int)Math.Floor(customer.PointsBalance / (decimal)cfg.PointsPerReais * 100) : 0,
            canRedeem      = customer.PointsBalance >= cfg.MinRedemptionPoints,
            minRedemptionPoints = cfg.MinRedemptionPoints,
            transactions,
        });
    }

    // ── POST /admin/loyalty/customers/{customerId}/redeem ─────────────────────
    [HttpPost("customers/{customerId:guid}/redeem")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> Redeem(
        Guid customerId,
        [FromBody] RedeemPointsRequest req,
        CancellationToken ct)
    {
        try
        {
            var discountCents = await _loyalty.RedeemAsync(
                CompanyId, customerId, req.SaleOrderId, req.PointsToRedeem, req.OrderTotalCents, ct);

            return Ok(new { discountCents, message = $"Desconto de R$ {discountCents / 100m:F2} aplicado." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ── POST /admin/loyalty/customers/{customerId}/adjust ─────────────────────
    [HttpPost("customers/{customerId:guid}/adjust")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Adjust(
        Guid customerId,
        [FromBody] AdjustPointsRequest req,
        CancellationToken ct)
    {
        try
        {
            await _loyalty.AdjustAsync(CompanyId, customerId, req.Points, req.Reason, ct);
            return Ok(new { message = $"Pontos ajustados em {req.Points:+#;-#;0}." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ── GET /admin/loyalty/ranking ────────────────────────────────────────────
    [HttpGet("ranking")]
    public async Task<IActionResult> Ranking([FromQuery] int top = 20, CancellationToken ct = default)
    {
        var customers = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId && c.PointsBalance > 0)
            .OrderByDescending(c => c.PointsBalance)
            .Take(top)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Phone,
                c.PointsBalance,
                c.TotalSpentCents,
                c.TotalOrders,
                c.LastOrderUtc,
            })
            .ToListAsync(ct);

        return Ok(customers);
    }

    // ── GET /admin/loyalty/summary ────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var companyId = CompanyId;

        var cfg = await _loyalty.GetOrCreateConfigAsync(companyId, ct);

        var totalPointsIssued = await _db.LoyaltyTransactions
            .Where(t => t.CompanyId == companyId && t.Points > 0)
            .SumAsync(t => (long)t.Points, ct);

        var totalPointsRedeemed = await _db.LoyaltyTransactions
            .Where(t => t.CompanyId == companyId && t.Points < 0)
            .SumAsync(t => (long)t.Points, ct);

        var customersWithBalance = await _db.Customers
            .CountAsync(c => c.CompanyId == companyId && c.PointsBalance > 0, ct);

        var totalBalance = await _db.Customers
            .Where(c => c.CompanyId == companyId)
            .SumAsync(c => (long)c.PointsBalance, ct);

        return Ok(new
        {
            config              = cfg,
            totalPointsIssued,
            totalPointsRedeemed = Math.Abs(totalPointsRedeemed),
            totalBalanceOutstanding = totalBalance,
            customersWithBalance,
        });
    }
}

public record UpsertLoyaltyConfigRequest(
    bool? IsEnabled,
    decimal? PointsPerReal,
    int? PointsPerReais,
    int? MinRedemptionPoints,
    int? MaxDiscountPercent
);

public record RedeemPointsRequest(Guid SaleOrderId, int PointsToRedeem, int OrderTotalCents);
public record AdjustPointsRequest(int Points, string Reason);
