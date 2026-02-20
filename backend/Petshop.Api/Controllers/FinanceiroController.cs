using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Financeiro;
using Petshop.Api.Data;
using Petshop.Api.Entities.Delivery;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/financeiro")]
[Authorize(Roles = "admin")]
public class FinanceiroController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<FinanceiroController> _logger;

    public FinanceiroController(AppDbContext db, ILogger<FinanceiroController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // =========================================
    // GET /admin/financeiro?period=7
    // =========================================
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int period = 7, CancellationToken ct = default)
    {
        if (period < 1 || period > 365) period = 30;

        var since = DateTime.UtcNow.Date.AddDays(-period + 1);
        const int perDeliveryCents = 1000; // R$10,00 por entrega

        // Paradas entregues no período
        var deliveredStops = await _db.RouteStops
            .Where(s =>
                s.Status == RouteStopStatus.Entregue &&
                s.DeliveredAtUtc.HasValue &&
                s.DeliveredAtUtc.Value.Date >= since)
            .Include(s => s.Route)
                .ThenInclude(r => r!.Deliverer)
            .Include(s => s.Order)
            .Select(s => new
            {
                Date = s.DeliveredAtUtc!.Value.Date,
                DelivererName = s.Route != null && s.Route.Deliverer != null
                    ? s.Route.Deliverer.Name
                    : "Sem entregador",
                TotalCents = s.Order != null ? s.Order.TotalCents : 0,
            })
            .ToListAsync(ct);

        // Paradas com falha no período
        var failedStops = await _db.RouteStops
            .Where(s =>
                s.Status == RouteStopStatus.Falhou &&
                s.FailedAtUtc.HasValue &&
                s.FailedAtUtc.Value.Date >= since)
            .Select(s => new { Date = s.FailedAtUtc!.Value.Date })
            .ToListAsync(ct);

        // DailyStats: uma linha por dia do período
        var allDates = Enumerable.Range(0, period)
            .Select(i => since.AddDays(i))
            .ToList();

        var dailyStats = allDates.Select(date => new DailyStatDto(
            Date: date.ToString("yyyy-MM-dd"),
            RevenueCents: deliveredStops.Where(s => s.Date == date).Sum(s => s.TotalCents),
            Deliveries: deliveredStops.Count(s => s.Date == date),
            Failures: failedStops.Count(s => s.Date == date)
        )).ToList();

        // Comissões por entregador
        var commissions = deliveredStops
            .GroupBy(s => s.DelivererName)
            .Select(g => new DelivererCommissionDto(
                DelivererName: g.Key,
                TotalDeliveries: g.Count(),
                CommissionCents: g.Count() * perDeliveryCents,
                PerDeliveryCents: perDeliveryCents
            ))
            .OrderByDescending(d => d.TotalDeliveries)
            .ToList();

        var totalDeliveries = deliveredStops.Count;
        var totalFailures = failedStops.Count;
        var totalRevenue = deliveredStops.Sum(s => s.TotalCents);

        _logger.LogInformation(
            "💰 Financeiro: period={Period}d | entregas={D} | falhas={F} | receita=R${R:F2}",
            period, totalDeliveries, totalFailures, totalRevenue / 100.0);

        return Ok(new FinanceiroResponse(
            Period: period,
            TotalRevenueCents: totalRevenue,
            TotalDeliveries: totalDeliveries,
            AvgPerDeliveryCents: totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0,
            TotalFailures: totalFailures,
            DailyStats: dailyStats,
            DelivererCommissions: commissions
        ));
    }
}
