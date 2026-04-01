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
            .Select(o => new
            {
                o.TotalCents,
                o.DiscountCents,
                o.SubtotalCents,
                o.CustomerId,
                o.CustomerPhone,
                o.CustomerDocument,
            })
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

        var count         = orders.Count;
        var totalRevenue  = orders.Sum(o => o.TotalCents);
        var totalDiscount = orders.Sum(o => o.DiscountCents);
        var subtotalCents = orders.Sum(o => o.SubtotalCents);

        var totalItems = await (
            from item in _db.SaleOrderItems
            join order in _db.SaleOrders on item.SaleOrderId equals order.Id
            where order.CompanyId == CompanyId
               && order.Status == SaleOrderStatus.Completed
               && order.CompletedAtUtc >= utcFrom
               && order.CompletedAtUtc < utcTo
            select item.IsSoldByWeight
                ? (item.WeightKg ?? item.Qty)
                : item.Qty
        ).SumAsync(ct);

        var peakHour = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId
                     && o.Status == SaleOrderStatus.Completed
                     && o.CompletedAtUtc >= utcFrom
                     && o.CompletedAtUtc < utcTo)
            .GroupBy(o => o.CompletedAtUtc!.Value.Hour)
            .Select(g => new { Hour = g.Key, RevenueCents = g.Sum(x => x.TotalCents), Orders = g.Count() })
            .OrderByDescending(x => x.RevenueCents)
            .ThenByDescending(x => x.Orders)
            .FirstOrDefaultAsync(ct);

        var peakDay = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId
                     && o.Status == SaleOrderStatus.Completed
                     && o.CompletedAtUtc >= utcFrom
                     && o.CompletedAtUtc < utcTo)
            .GroupBy(o => o.CompletedAtUtc!.Value.Date)
            .Select(g => new { Date = g.Key, RevenueCents = g.Sum(x => x.TotalCents), Orders = g.Count() })
            .OrderByDescending(x => x.RevenueCents)
            .ThenByDescending(x => x.Orders)
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            totalRevenueCents  = totalRevenue,
            totalOrders        = count,
            avgTicketCents     = count > 0 ? totalRevenue / count : 0,
            totalDiscountCents = totalDiscount,
            subtotalCents      = subtotalCents,
            discountRatePercent = subtotalCents > 0
                ? Math.Round((decimal)totalDiscount / subtotalCents * 100m, 2)
                : 0m,
            ordersWithDiscount = orders.Count(o => o.DiscountCents > 0),
            identifiedCustomers = orders.Count(o =>
                o.CustomerId.HasValue
                || !string.IsNullOrWhiteSpace(o.CustomerPhone)
                || !string.IsNullOrWhiteSpace(o.CustomerDocument)),
            totalItems = totalItems,
            avgItemsPerOrder = count > 0
                ? Math.Round(totalItems / count, 3)
                : 0m,
            peakHour = peakHour is null ? null : new
            {
                hour = peakHour.Hour,
                revenueCents = peakHour.RevenueCents,
                orderCount = peakHour.Orders,
            },
            peakDay = peakDay is null ? null : new
            {
                date = DateOnly.FromDateTime(peakDay.Date).ToString("yyyy-MM-dd"),
                revenueCents = peakDay.RevenueCents,
                orderCount = peakDay.Orders,
            },
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

    // ── GET /admin/reports/sales/by-hour ──────────────────────────────────────
    [HttpGet("sales/by-hour")]
    public async Task<IActionResult> SalesByHour(
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
            .GroupBy(o => o.CompletedAtUtc!.Value.Hour)
            .Select(g => new
            {
                Hour = g.Key,
                RevenueCents = g.Sum(o => o.TotalCents),
                OrderCount = g.Count(),
            })
            .ToListAsync(ct);

        var result = Enumerable.Range(0, 24)
            .Select(hour =>
            {
                var row = rows.FirstOrDefault(x => x.Hour == hour);
                return new
                {
                    hour,
                    revenueCents = row?.RevenueCents ?? 0,
                    orderCount = row?.OrderCount ?? 0,
                };
            })
            .ToList();

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

    // ── GET /admin/reports/products/by-category ───────────────────────────────
    [HttpGet("products/by-category")]
    public async Task<IActionResult> ProductsByCategory(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var byProduct = await (
            from item in _db.SaleOrderItems
            join order in _db.SaleOrders on item.SaleOrderId equals order.Id
            where order.CompanyId == CompanyId
               && order.Status == SaleOrderStatus.Completed
               && order.CompletedAtUtc >= utcFrom
               && order.CompletedAtUtc < utcTo
            group item by item.ProductId into g
            select new
            {
                productId = g.Key,
                revenueCents = g.Sum(i => i.TotalCents),
                totalQty = g.Sum(i => i.IsSoldByWeight ? (i.WeightKg ?? 0) : i.Qty),
                transactions = g.Count(),
            }
        )
        .ToListAsync(ct);

        var productCategories = await _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == CompanyId)
            .Join(_db.Categories.AsNoTracking(),
                p => p.CategoryId,
                c => c.Id,
                (p, c) => new { p.Id, CategoryName = c.Name })
            .ToDictionaryAsync(x => x.Id, x => x.CategoryName, ct);

        var rows = byProduct
            .GroupBy(x =>
                productCategories.TryGetValue(x.productId, out var categoryName)
                    ? categoryName
                    : "Sem categoria")
            .Select(g => new
            {
                category = g.Key,
                revenueCents = g.Sum(x => x.revenueCents),
                totalQty = g.Sum(x => x.totalQty),
                transactions = g.Sum(x => x.transactions),
            })
            .OrderByDescending(x => x.revenueCents)
            .ToList();

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
            healthyStockCount = products.Count(p => p.StockQty > 0
                                                 && (!p.ReorderPoint.HasValue || p.StockQty > p.ReorderPoint)),
            lowStockValueCents = (long)products
                .Where(p => p.ReorderPoint.HasValue && p.StockQty > 0 && p.StockQty <= p.ReorderPoint)
                .Sum(p => p.StockQty * p.CostCents),
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
            avgTransmissionAttempts = await _db.FiscalDocuments
                .AsNoTracking()
                .Where(d => d.CompanyId == CompanyId
                         && d.CreatedAtUtc >= utcFrom
                         && d.CreatedAtUtc < utcTo)
                .Select(d => (double)d.TransmissionAttempts)
                .DefaultIfEmpty(0)
                .AverageAsync(ct),
        });
    }

    // ── GET /admin/reports/fiscal/rejections ──────────────────────────────────
    [HttpGet("fiscal/rejections")]
    public async Task<IActionResult> FiscalRejections(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        var (utcFrom, utcTo) = ToUtcRange(from, to);

        var rows = await _db.FiscalDocuments
            .AsNoTracking()
            .Where(d => d.CompanyId == CompanyId
                     && d.CreatedAtUtc >= utcFrom
                     && d.CreatedAtUtc < utcTo
                     && d.FiscalStatus == FiscalDocumentStatus.Rejected)
            .GroupBy(d => new { d.RejectCode, d.RejectMessage })
            .Select(g => new
            {
                code = g.Key.RejectCode ?? "N/A",
                message = g.Key.RejectMessage ?? "Sem mensagem",
                count = g.Count(),
                lastSeenAtUtc = g.Max(x => x.UpdatedAtUtc ?? x.CreatedAtUtc),
            })
            .OrderByDescending(x => x.count)
            .Take(10)
            .ToListAsync(ct);

        return Ok(rows);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (DateTime From, DateTime To) ToUtcRange(DateOnly from, DateOnly to)
    {
        var utcFrom = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var utcTo   = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return (utcFrom, utcTo);
    }
}
