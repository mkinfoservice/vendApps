using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Delivery;
using Petshop.Api.Contracts.Delivery.DelivererPortal;
using Petshop.Api.Data;
using Petshop.Api.Entities.Delivery;
using Petshop.Api.Services;
using Petshop.Api.Services.Routes;
using Route = Petshop.Api.Entities.Delivery.Route;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("deliverer")]
[Authorize(Roles = "deliverer")]
public class DelivererPortalController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RouteStopTransitionService _transitions;
    private readonly DepotService _depot;
    private readonly ILogger<DelivererPortalController> _logger;

    public DelivererPortalController(
        AppDbContext db,
        RouteStopTransitionService transitions,
        DepotService depot,
        ILogger<DelivererPortalController> logger)
    {
        _db = db;
        _transitions = transitions;
        _depot = depot;
        _logger = logger;
    }

    private Guid GetDelivererId() =>
        Guid.Parse(User.FindFirstValue("delivererId")!);

    private async Task<Route?> GetRouteForDeliverer(Guid routeId, CancellationToken ct, bool tracking = true)
    {
        var delivererId = GetDelivererId();
        var q = tracking ? _db.Routes.AsQueryable() : _db.Routes.AsNoTracking();
        return await q
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId && r.DelivererId == delivererId, ct);
    }

    // =========================================
    // GET /deliverer/me/active-route
    // =========================================
    [HttpGet("me/active-route")]
    public async Task<IActionResult> GetActiveRoute(CancellationToken ct = default)
    {
        var delivererId = GetDelivererId();

        var route = await _db.Routes
            .AsNoTracking()
            .Include(r => r.Stops)
            .Where(r => r.DelivererId == delivererId &&
                        (r.Status == RouteStatus.Criada ||
                         r.Status == RouteStatus.Atribuida ||
                         r.Status == RouteStatus.EmAndamento))
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (route is null)
        {
            return Ok(new DelivererActiveRouteResponse { HasActiveRoute = false });
        }

        var completedStops = route.Stops.Count(s => RouteStopTransitionService.IsFinalStopStatus(s.Status));
        var nextStop = route.Stops
            .OrderBy(s => s.Sequence)
            .FirstOrDefault(s => s.Status == RouteStopStatus.Proxima);

        return Ok(new DelivererActiveRouteResponse
        {
            HasActiveRoute = true,
            RouteId = route.Id,
            RouteNumber = route.RouteNumber,
            Status = route.Status.ToString(),
            TotalStops = route.TotalStops,
            CompletedStops = completedStops,
            RemainingStops = route.TotalStops - completedStops,
            NextStop = nextStop != null ? MapStopDto(nextStop) : null
        });
    }

    // =========================================
    // GET /deliverer/routes/{routeId}
    // =========================================
    [HttpGet("routes/{routeId:guid}")]
    public async Task<IActionResult> GetRouteDetail([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct, tracking: false);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        var completedStops = route.Stops.Count(s => RouteStopTransitionService.IsFinalStopStatus(s.Status));
        var nextStop = route.Stops
            .OrderBy(s => s.Sequence)
            .FirstOrDefault(s => s.Status == RouteStopStatus.Proxima);

        return Ok(new DelivererRouteDetailResponse
        {
            RouteId = route.Id,
            RouteNumber = route.RouteNumber,
            Status = route.Status.ToString(),
            TotalStops = route.TotalStops,
            CompletedStops = completedStops,
            NextStopId = nextStop?.Id,
            NextStop = nextStop != null ? MapStopDto(nextStop) : null,
            Stops = route.Stops
                .OrderBy(s => s.Sequence)
                .Select(MapStopDto)
                .ToList(),
            Depot = new DelivererDepotInfo
            {
                Name = "Petshop Central",
                Address = _depot.GetDepotAddress()
            },
            Progress = new DelivererProgressInfo
            {
                Done = completedStops,
                Total = route.TotalStops
            }
        });
    }

    // =========================================
    // PATCH /deliverer/routes/{routeId}/start
    // =========================================
    [HttpPatch("routes/{routeId:guid}/start")]
    public async Task<IActionResult> StartRoute([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        var result = _transitions.StartRoute(route);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("🚀 DELIVERER_ROUTE_START: delivererId={DelivererId}, routeId={RouteId}",
            GetDelivererId(), routeId);

        return Ok(new
        {
            routeId = route.Id,
            routeNumber = route.RouteNumber,
            status = route.Status.ToString(),
            startedAtUtc = route.StartedAtUtc
        });
    }

    // =========================================
    // PATCH /deliverer/routes/{routeId}/stops/{stopId}/delivered
    // =========================================
    [HttpPatch("routes/{routeId:guid}/stops/{stopId:guid}/delivered")]
    public async Task<IActionResult> MarkDelivered(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        var result = await _transitions.MarkDeliveredAsync(route, stopId, ct);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("✅ DELIVERER_STOP_DELIVERED: delivererId={DelivererId}, routeId={RouteId}, stopId={StopId}",
            GetDelivererId(), routeId, stopId);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            deliveredAtUtc = result.Stop.DeliveredAtUtc,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString()
        });
    }

    // =========================================
    // PATCH /deliverer/routes/{routeId}/stops/{stopId}/fail
    // =========================================
    [HttpPatch("routes/{routeId:guid}/stops/{stopId:guid}/fail")]
    public async Task<IActionResult> FailStop(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        [FromBody] FailRouteStopRequest req,
        CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        if (req is null || string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest("Reason é obrigatório para marcar falha.");

        var result = await _transitions.MarkFailedAsync(route, stopId, req.Reason, ct);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("❌ DELIVERER_STOP_FAILED: delivererId={DelivererId}, routeId={RouteId}, stopId={StopId}, reason={Reason}",
            GetDelivererId(), routeId, stopId, req.Reason);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            failedAtUtc = result.Stop.FailedAtUtc,
            reason = result.Stop.FailureReason,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString()
        });
    }

    // =========================================
    // PATCH /deliverer/routes/{routeId}/stops/{stopId}/skip
    // =========================================
    [HttpPatch("routes/{routeId:guid}/stops/{stopId:guid}/skip")]
    public async Task<IActionResult> SkipStop(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        [FromBody] SkipRouteStopRequest? req,
        CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        var result = await _transitions.MarkSkippedAsync(route, stopId, req?.Reason, ct);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("⏭️ DELIVERER_STOP_SKIPPED: delivererId={DelivererId}, routeId={RouteId}, stopId={StopId}",
            GetDelivererId(), routeId, stopId);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            reason = result.Stop.FailureReason,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString()
        });
    }

    // =========================================
    // GET /deliverer/routes/{routeId}/navigation/next
    // =========================================
    [HttpGet("routes/{routeId:guid}/navigation/next")]
    public async Task<IActionResult> GetNextNavigation([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var route = await GetRouteForDeliverer(routeId, ct, tracking: false);
        if (route is null) return NotFound("Rota não encontrada ou não pertence a este entregador.");

        var nextStop = route.Stops
            .OrderBy(s => s.Sequence)
            .FirstOrDefault(s => s.Status == RouteStopStatus.Proxima);

        if (nextStop is null)
        {
            var allDone = route.Stops.All(s => RouteStopTransitionService.IsFinalStopStatus(s.Status));
            return Ok(new DelivererNextNavigationResponse
            {
                RouteCompleted = allDone
            });
        }

        var hasCoords = nextStop.Latitude.HasValue && nextStop.Longitude.HasValue;
        string? wazeLink = null;
        string? googleMapsLink = null;

        if (hasCoords)
        {
            var lat = nextStop.Latitude!.Value.ToString("G", System.Globalization.CultureInfo.InvariantCulture);
            var lon = nextStop.Longitude!.Value.ToString("G", System.Globalization.CultureInfo.InvariantCulture);
            wazeLink = $"waze://?ll={lat},{lon}&navigate=yes";
            googleMapsLink = $"https://www.google.com/maps/dir/?api=1&destination={lat},{lon}";
        }

        return Ok(new DelivererNextNavigationResponse
        {
            NextStopId = nextStop.Id,
            CustomerName = nextStop.CustomerNameSnapshot,
            Address = nextStop.AddressSnapshot,
            Latitude = nextStop.Latitude,
            Longitude = nextStop.Longitude,
            WazeLink = wazeLink,
            GoogleMapsLink = googleMapsLink,
            HasCoordinates = hasCoords,
            RouteCompleted = false
        });
    }

    private static DelivererStopDto MapStopDto(RouteStop s) => new()
    {
        StopId = s.Id,
        Sequence = s.Sequence,
        OrderNumber = s.OrderNumberSnapshot,
        CustomerName = s.CustomerNameSnapshot,
        CustomerPhone = s.CustomerPhoneSnapshot,
        Address = s.AddressSnapshot,
        Status = s.Status.ToString(),
        Latitude = s.Latitude,
        Longitude = s.Longitude,
        DeliveredAtUtc = s.DeliveredAtUtc?.ToString("o"),
        FailureReason = s.FailureReason
    };
}
