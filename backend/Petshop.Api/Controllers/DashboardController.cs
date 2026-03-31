using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Dashboard;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Delivery;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/dashboard")]
[Authorize(Roles = "admin,gerente,atendente")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // =========================================
    // GET /admin/dashboard
    // =========================================
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var companyId = CompanyId;

        // Pedidos por status
        var orderCounts = await _db.Orders
            .Where(o => o.CompanyId == companyId)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var od = orderCounts.ToDictionary(x => x.Status, x => x.Count);

        // Rotas por status — filtra por rotas que possuem paradas de pedidos desta empresa
        var routeCounts = await _db.Routes
            .Where(r => r.Stops.Any(s => s.Order.CompanyId == companyId))
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var rd = routeCounts.ToDictionary(x => x.Status, x => x.Count);

        // Entregadores (Deliverer não tem CompanyId — mostra todos os ativos da plataforma)
        var totalDeliverers = await _db.Deliverers.CountAsync(ct);
        var activeDeliverers = await _db.Deliverers.CountAsync(d => d.IsActive, ct);

        // Entregadores com rota ativa desta empresa
        var deliverersWithRoute = await _db.Routes
            .Where(r => r.Stops.Any(s => s.Order.CompanyId == companyId) &&
                (r.Status == RouteStatus.Criada ||
                 r.Status == RouteStatus.Atribuida ||
                 r.Status == RouteStatus.EmAndamento))
            .Select(r => r.DelivererId)
            .Distinct()
            .CountAsync(ct);

        // Pedidos PRONTO_PARA_ENTREGA com e sem coordenadas
        var readyCoords = await _db.Orders
            .Where(o => o.CompanyId == companyId && o.Status == OrderStatus.PRONTO_PARA_ENTREGA)
            .Select(o => new { o.Latitude, o.Longitude })
            .ToListAsync(ct);

        var readyWithCoords = readyCoords.Count(o => o.Latitude.HasValue && o.Longitude.HasValue);
        var readyWithoutCoords = readyCoords.Count - readyWithCoords;

        return Ok(new AdminDashboardResponse(
            Orders: new OrderCountsDto(
                Recebido: od.GetValueOrDefault(OrderStatus.RECEBIDO),
                EmPreparo: od.GetValueOrDefault(OrderStatus.EM_PREPARO),
                ProntoParaEntrega: od.GetValueOrDefault(OrderStatus.PRONTO_PARA_ENTREGA),
                SaiuParaEntrega: od.GetValueOrDefault(OrderStatus.SAIU_PARA_ENTREGA),
                Entregue: od.GetValueOrDefault(OrderStatus.ENTREGUE),
                Cancelado: od.GetValueOrDefault(OrderStatus.CANCELADO)
            ),
            Routes: new RouteCountsDto(
                Criada: rd.GetValueOrDefault(RouteStatus.Criada),
                Atribuida: rd.GetValueOrDefault(RouteStatus.Atribuida),
                EmAndamento: rd.GetValueOrDefault(RouteStatus.EmAndamento),
                Concluida: rd.GetValueOrDefault(RouteStatus.Concluida),
                Cancelada: rd.GetValueOrDefault(RouteStatus.Cancelada)
            ),
            Deliverers: new DelivererStatsDto(
                Total: totalDeliverers,
                Active: activeDeliverers,
                WithActiveRoute: deliverersWithRoute
            ),
            ReadyOrdersWithCoords: readyWithCoords,
            ReadyOrdersWithoutCoords: readyWithoutCoords,
            UpdatedAtUtc: DateTime.UtcNow
        ));
    }
}
