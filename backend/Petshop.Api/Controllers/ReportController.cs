using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Pdv;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Relatórios e analytics por empresa.
/// Todos os endpoints filtram por CompanyId extraído do JWT.
/// </summary>
[ApiController]
[Route("admin/reports")]
[Authorize(Roles = "admin,gerente")]
public class ReportController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReportController(AppDbContext db) => _db = db;

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/reports/sales/summary ──────────────────────────────────────
    [HttpGet("sales/summary")]
    public async Task<IActionResult> SalesSummary(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var orders = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId
                     && o.Status == SaleOrderStatus.Completed
                     && o.CompletedAtUtc >= utcFrom
                     && o.CompletedAtUtc < utcTo)
            .Select(o => new { o.TotalCents, o.DiscountCents, o.SubtotalCents })
            .ToListAsync(ct);

        var payments = await (
            from p in _db.SalePayments
            join o in _db.SaleOrders on p.SaleOrderId equals o.Id
            where o.CompanyId == CompanyId
               && o.Status == SaleOrderStatus.Completed
               && o.CompletedAtUtc >= utcFrom
               && o.CompletedAtUtc < utcTo
            group p by p.PaymentMethod into g
            select new
            {
                Method = g.Key,
                Count  = g.Count(),
                TotalCents = g.Sum(x => x.AmountCents),
            }
        ).OrderByDescending(g => g.TotalCents).ToListAsync(ct);

        var count        = orders.Count;
        var totalRevenue = orders.Sum(o => o.TotalCents);
        var totalDiscount= orders.Sum(o => o.DiscountCents);

        return Ok(new
        {
            totalRevenueCents  = totalRevenue,
            totalOrders        = count,
            avgTicketCents     = count > 0 ? totalRevenue / count : 0,
            totalDiscountCents = totalDiscount,
            byPaymentMethod    = payments,
        });
    }

    // ── GET /admin/reports/sales/by-day ───────────────────────────────────────
    [HttpGet("sales/by-day")]
    public async Task<IActionResult> SalesByDay(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var rows = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId
                     && o.Status == SaleOrderStatus.Completed
                     && o.CompletedAtUtc >= utcFrom
                     && o.CompletedAtUtc < utcTo)
            .GroupBy(o => o.CompletedAtUtc!.Value.Date)
            .Select(g => new
            {
                Date         = g.Key,
                RevenueCents = g.Sum(o => o.TotalCents),
                OrderCount   = g.Count(),
            })
            .OrderBy(g => g.Date)
            .ToListAsync(ct);

        // Preenche dias sem vendas com zero
        var result = new List<object>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            var utcDate = d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var row = rows.FirstOrDefault(r => r.Date.Date == utcDate.Date);
            result.Add(new
            {
                date         = d.ToString("yyyy-MM-dd"),
                revenueCents = row?.RevenueCents ?? 0,
                orderCount   = row?.OrderCount ?? 0,
            });
        }

        return Ok(result);
    }

    // ── GET /admin/reports/products/top ───────────────────────────────────────
    [HttpGet("products/top")]
    public async Task<IActionResult> TopProducts(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var rows = await (
            from item in _db.SaleOrderItems
            join order in _db.SaleOrders on item.SaleOrderId equals order.Id
            where order.CompanyId == CompanyId
               && order.Status == SaleOrderStatus.Completed
               && order.CompletedAtUtc >= utcFrom
               && order.CompletedAtUtc < utcTo
            group item by new { item.ProductId, item.ProductNameSnapshot } into g
            select new
            {
                g.Key.ProductId,
                Name           = g.Key.ProductNameSnapshot,
                TotalCents     = g.Sum(i => i.TotalCents),
                TotalQty       = g.Sum(i => i.IsSoldByWeight ? (i.WeightKg ?? 0) : i.Qty),
                TransactionCount = g.Count(),
            }
        )
        .OrderByDescending(g => g.TotalCents)
        .Take(limit)
        .ToListAsync(ct);

        return Ok(rows);
    }

    // ── GET /admin/reports/stock/valuation ────────────────────────────────────
    [HttpGet("stock/valuation")]
    public async Task<IActionResult> StockValuation(CancellationToken ct)
    {
        var products = await _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == CompanyId && p.IsActive)
            .Select(p => new { p.StockQty, p.CostCents, p.ReorderPoint })
            .ToListAsync(ct);

        var totalValueCents = products
            .Where(p => p.StockQty > 0)
            .Sum(p => (long)(p.StockQty * p.CostCents));

        return Ok(new
        {
            totalProducts     = products.Count,
            totalValueCents   = (long)totalValueCents,
            outOfStockCount   = products.Count(p => p.StockQty <= 0),
            lowStockCount     = products.Count(p => p.ReorderPoint.HasValue
                                                 && p.StockQty > 0
                                                 && p.StockQty <= p.ReorderPoint),
        });
    }

    // ── GET /admin/reports/fiscal ─────────────────────────────────────────────
    [HttpGet("fiscal")]
    public async Task<IActionResult> FiscalSummary(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var rows = await _db.FiscalDocuments
            .AsNoTracking()
            .Where(d => d.CompanyId == CompanyId
                     && d.CreatedAtUtc >= utcFrom
                     && d.CreatedAtUtc < utcTo)
            .GroupBy(d => d.FiscalStatus)
            .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
            .ToListAsync(ct);

        return Ok(new
        {
            authorized  = rows.FirstOrDefault(r => r.Status == "Authorized")?.Count ?? 0,
            rejected    = rows.FirstOrDefault(r => r.Status == "Rejected")?.Count ?? 0,
            contingency = rows.FirstOrDefault(r => r.Status == "Contingency")?.Count ?? 0,
            pending     = rows.FirstOrDefault(r => r.Status == "Pending")?.Count ?? 0,
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (DateTime From, DateTime To) ToUtcRange(DateOnly from, DateOnly to)
    {
        var utcFrom = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var utcTo   = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return (utcFrom, utcTo);
    }
}
