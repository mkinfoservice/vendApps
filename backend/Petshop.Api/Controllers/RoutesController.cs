using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Delivery;
using Petshop.Api.Contracts.Delivery.Routes.Preview;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Delivery;
using Petshop.Api.Services;
using Petshop.Api.Services.Routes;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("routes")]
public class RoutesController : ControllerBase
{
    private readonly DeliveryManagementService _service;
    private readonly RoutePreviewService _previewService;
    private readonly RouteStopTransitionService _transitions;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<RoutesController> _logger;

    public RoutesController(
        DeliveryManagementService service,
        RoutePreviewService previewService,
        RouteStopTransitionService transitions,
        AppDbContext db,
        IConfiguration config,
        ILogger<RoutesController> logger)
    {
        _service = service;
        _previewService = previewService;
        _transitions = transitions;
        _db = db;
        _config = config;
        _logger = logger;
    }

    // =========================================
    // AUTH (DEV BYPASS)
    // =========================================
    // Em desenvolvimento, se Jwt:SwaggerBypass=true, libera testar no Swagger sem token.
    private bool SwaggerBypassEnabled =>
        string.Equals(_config["Jwt:SwaggerBypass"], "true", StringComparison.OrdinalIgnoreCase);

    private bool IsAuthenticatedAdmin()
    {
        if (SwaggerBypassEnabled) return true;
        return User?.Identity?.IsAuthenticated == true && User.IsInRole("admin");
    }

    private IActionResult? RequireAdmin()
    {
        if (!IsAuthenticatedAdmin())
            return Unauthorized("Faça login como admin para acessar /routes.");
        return null;
    }

    // =========================================
    // POST /routes  (criar rota)
    // =========================================
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRouteRequest request, CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        if (request is null)
            return BadRequest("Body inválido.");

        if (request.DelivererId == Guid.Empty)
            return BadRequest("DelivererId é obrigatório.");

        if (request.OrderIds is null || request.OrderIds.Count == 0)
            return BadRequest("Nenhum pedido informado.");

        // Validar RouteSide (se fornecido)
        if (!string.IsNullOrWhiteSpace(request.RouteSide))
        {
            var sideUpper = request.RouteSide.Trim().ToUpperInvariant();
            if (sideUpper != "A" && sideUpper != "B")
                return BadRequest("RouteSide deve ser 'A', 'B' ou null");
        }

        try
        {
            var route = await _service.CreateRouteAsync(
                request.DelivererId,
                request.OrderIds,
                request.RouteSide,
                ct);

            // Se a rota nasceu Criada/Atribuida, as stops normalmente nascem Pendente.
            // (o Start vai marcar a primeira como Proxima)

            var response = new CreateRouteResponse
            {
                RouteId = route.Id,
                RouteNumber = route.RouteNumber,
                TotalStops = route.TotalStops,
                Stops = route.Stops
                    .OrderBy(s => s.Sequence)
                    .Select(s => new RouteStopDto
                    {
                        StopId = s.Id,
                        Sequence = s.Sequence,
                        OrderNumber = s.OrderNumberSnapshot,
                        CustomerName = s.CustomerNameSnapshot,
                        Status = s.Status.ToString()
                    })
                    .ToList()
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // =========================================
    // POST /routes/preview (prever rotas bidirecionais)
    // =========================================
    [HttpPost("preview")]
    public async Task<IActionResult> PreviewRoutes(
        [FromBody] PreviewRouteRequest request,
        CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        if (request is null)
            return BadRequest("Body inválido.");

        if (request.OrderIds is null || request.OrderIds.Count == 0)
            return BadRequest("Nenhum pedido informado.");

        try
        {
            _logger.LogInformation("🗺️ Gerando preview de rotas para {Count} pedidos", request.OrderIds.Count);

            var preview = await _previewService.PreviewRoutesAsync(request.OrderIds, ct);

            return Ok(preview);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Erro ao gerar preview de rotas");
            return BadRequest(ex.Message);
        }
    }

    // =========================================
    // GET /routes  (listar rotas)
    // =========================================
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        CancellationToken ct = default
    )
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var q = _db.Routes
            .AsNoTracking()
            .Include(r => r.Deliverer)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<RouteStatus>(status.Trim(), true, out var parsed))
                return BadRequest($"Status inválido: {status}");

            q = q.Where(r => r.Status == parsed);
        }

        q = q.OrderByDescending(r => r.CreatedAtUtc);

        var total = await q.CountAsync(ct);

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                id = r.Id,
                routeNumber = r.RouteNumber,
                status = r.Status.ToString(),
                totalStops = r.TotalStops,
                delivererName = r.Deliverer != null ? r.Deliverer.Name : null,
                delivererVehicle = r.Deliverer != null ? r.Deliverer.Vehicle : null,
                createdAtUtc = r.CreatedAtUtc,
                startedAtUtc = r.StartedAtUtc,
                completedAtUtc = r.CompletedAtUtc
            })
            .ToListAsync(ct);

        return Ok(new
        {
            page,
            pageSize,
            total,
            items
        });
    }

    // =========================================
    // GET /routes/{routeId}
    // =========================================
    [HttpGet("{routeId:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .AsNoTracking()
            .Include(r => r.Deliverer)
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null)
            return NotFound("Rota não encontrada.");

        var stops = route.Stops
            .OrderBy(s => s.Sequence)
            .Select(s => new
            {
                stopId = s.Id,
                sequence = s.Sequence,
                orderId = s.OrderId,
                orderNumber = s.OrderNumberSnapshot,
                customerName = s.CustomerNameSnapshot,
                customerPhone = s.CustomerPhoneSnapshot,
                address = s.AddressSnapshot,
                status = s.Status.ToString(),
                deliveredAtUtc = s.DeliveredAtUtc
            })
            .ToList();

        return Ok(new
        {
            id = route.Id,
            routeNumber = route.RouteNumber,
            status = route.Status.ToString(),
            totalStops = route.TotalStops,
            delivererId = route.DelivererId,
            delivererName = route.Deliverer?.Name,
            delivererPhone = route.Deliverer?.Phone,
            delivererVehicle = route.Deliverer?.Vehicle,
            createdAtUtc = route.CreatedAtUtc,
            startedAtUtc = route.StartedAtUtc,
            completedAtUtc = route.CompletedAtUtc,
            stops
        });
    }

    // =========================================
    // GET /routes/{routeId}/navigation
    // =========================================
    [HttpGet("{routeId:guid}/navigation")]
    public async Task<IActionResult> GetNavigationLinks([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .AsNoTracking()
            .Include(r => r.Stops.OrderBy(s => s.Sequence))
                .ThenInclude(s => s.Order)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null)
            return NotFound("Rota não encontrada.");

        // Preparar lista de stops com coordenadas
        var stops = route.Stops
            .OrderBy(s => s.Sequence)
            .Select(s => new NavigationStopInfo
            {
                Sequence = s.Sequence,
                OrderNumber = s.OrderNumberSnapshot,
                CustomerName = s.CustomerNameSnapshot,
                Address = s.AddressSnapshot,
                Latitude = s.Order?.Latitude,
                Longitude = s.Order?.Longitude,
                HasCoordinates = s.Order?.Latitude != null && s.Order?.Longitude != null
            })
            .ToList();

        var stopsWithCoords = stops.Where(s => s.HasCoordinates).ToList();

        var warnings = new List<string>();

        if (stopsWithCoords.Count == 0)
        {
            warnings.Add("⚠️ Nenhuma parada possui coordenadas. Não é possível gerar links de navegação.");
            return Ok(new NavigationLinksResponse
            {
                RouteNumber = route.RouteNumber,
                TotalStops = route.TotalStops,
                StopsWithCoordinates = 0,
                WazeLink = "",
                GoogleMapsLink = "",
                GoogleMapsWebLink = "",
                Stops = stops,
                Warnings = warnings
            });
        }

        if (stopsWithCoords.Count < stops.Count)
        {
            warnings.Add($"⚠️ {stops.Count - stopsWithCoords.Count} parada(s) sem coordenadas serão ignoradas na navegação.");
        }

        // Gerar link do WAZE (apenas primeiro stop)
        var firstStop = stopsWithCoords.First();
        var lat = firstStop.Latitude?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
        var lon = firstStop.Longitude?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
        var wazeLink = $"waze://?ll={lat},{lon}&navigate=yes";

        // Gerar link do GOOGLE MAPS (rota completa)
        var googleMapsLink = GenerateGoogleMapsLink(stopsWithCoords, forApp: true);
        var googleMapsWebLink = GenerateGoogleMapsLink(stopsWithCoords, forApp: false);

        return Ok(new NavigationLinksResponse
        {
            RouteNumber = route.RouteNumber,
            TotalStops = route.TotalStops,
            StopsWithCoordinates = stopsWithCoords.Count,
            WazeLink = wazeLink,
            GoogleMapsLink = googleMapsLink,
            GoogleMapsWebLink = googleMapsWebLink,
            Stops = stops,
            Warnings = warnings
        });
    }

    private static string GenerateGoogleMapsLink(List<NavigationStopInfo> stops, bool forApp)
    {
        if (stops.Count == 0) return "";

        // Helper para formatar coordenadas com ponto decimal (cultura invariante)
        static string FormatCoord(double? lat, double? lon)
        {
            var latStr = lat?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
            var lonStr = lon?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
            return $"{latStr},{lonStr}";
        }

        if (stops.Count == 1)
        {
            // Apenas um stop: navegação direta
            var single = stops[0];
            var baseUrl = forApp ? "https://www.google.com/maps/dir/?api=1" : "https://www.google.com/maps/dir";
            return $"{baseUrl}&destination={FormatCoord(single.Latitude, single.Longitude)}";
        }

        // Múltiplos stops: origin -> waypoints -> destination
        var origin = stops.First();
        var destination = stops.Last();
        var waypoints = stops.Skip(1).Take(stops.Count - 2).ToList();

        var baseUrlMultiple = forApp ? "https://www.google.com/maps/dir/?api=1" : "https://www.google.com/maps/dir";
        var url = $"{baseUrlMultiple}&origin={FormatCoord(origin.Latitude, origin.Longitude)}&destination={FormatCoord(destination.Latitude, destination.Longitude)}";

        if (waypoints.Count > 0)
        {
            var waypointsStr = string.Join("|", waypoints.Select(w => FormatCoord(w.Latitude, w.Longitude)));
            url += $"&waypoints={waypointsStr}";
        }

        // Google Maps API tem limite de ~25 waypoints, mas para MVP está ok

        return url;
    }

    // =========================================
    // GET /routes/{routeId}/navigation/qr
    // =========================================
    [HttpGet("{routeId:guid}/navigation/qr")]
    public async Task<IActionResult> GetNavigationQrCodes([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .AsNoTracking()
            .Include(r => r.Stops.OrderBy(s => s.Sequence))
                .ThenInclude(s => s.Order)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null)
            return NotFound("Rota não encontrada.");

        // Preparar lista de stops com coordenadas
        var stops = route.Stops
            .OrderBy(s => s.Sequence)
            .Select(s => new NavigationStopInfo
            {
                Sequence = s.Sequence,
                OrderNumber = s.OrderNumberSnapshot,
                CustomerName = s.CustomerNameSnapshot,
                Address = s.AddressSnapshot,
                Latitude = s.Order?.Latitude,
                Longitude = s.Order?.Longitude,
                HasCoordinates = s.Order?.Latitude != null && s.Order?.Longitude != null
            })
            .ToList();

        var stopsWithCoords = stops.Where(s => s.HasCoordinates).ToList();

        if (stopsWithCoords.Count == 0)
        {
            return BadRequest("Nenhuma parada possui coordenadas para gerar links de navegação.");
        }

        // Gerar links
        var firstStop = stopsWithCoords.First();
        var lat = firstStop.Latitude?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
        var lon = firstStop.Longitude?.ToString("G", System.Globalization.CultureInfo.InvariantCulture) ?? "0";
        var wazeLink = $"waze://?ll={lat},{lon}&navigate=yes";
        var googleMapsLink = GenerateGoogleMapsLink(stopsWithCoords, forApp: true);

        // Gerar QR Codes (usando API pública gratuita)
        var wazeQrUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={Uri.EscapeDataString(wazeLink)}";
        var googleMapsQrUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={Uri.EscapeDataString(googleMapsLink)}";

        return Ok(new
        {
            routeNumber = route.RouteNumber,
            totalStops = route.TotalStops,
            stopsWithCoordinates = stopsWithCoords.Count,
            navigation = new
            {
                waze = new
                {
                    link = wazeLink,
                    qrCodeUrl = wazeQrUrl,
                    instructions = "Aponte a câmera do celular para o QR Code para abrir o Waze"
                },
                googleMaps = new
                {
                    link = googleMapsLink,
                    qrCodeUrl = googleMapsQrUrl,
                    instructions = "Aponte a câmera do celular para abrir o Google Maps"
                }
            },
            testInstructions = new
            {
                step1 = "Abra este endpoint no browser do PC",
                step2 = "Aponte a câmera do celular para o QR Code (não precisa app de QR, a câmera nativa lê)",
                step3 = "Clique no link que aparecer → deve abrir o app de navegação",
                alternative = "Ou copie o 'link' e envie para você mesmo via WhatsApp/Telegram"
            }
        });
    }

    // =========================================
    // PATCH /routes/{routeId}/start
    // =========================================
    [HttpPatch("{routeId:guid}/start")]
    public async Task<IActionResult> Start([FromRoute] Guid routeId, CancellationToken ct = default)
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null) return NotFound("Rota não encontrada.");

        var result = _transitions.StartRoute(route);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            routeId = route.Id,
            routeNumber = route.RouteNumber,
            status = route.Status.ToString(),
            startedAtUtc = route.StartedAtUtc
        });
    }

    // =========================================
    // PATCH /routes/{routeId}/stops/{stopId}/delivered
    // =========================================
    [HttpPatch("{routeId:guid}/stops/{stopId:guid}/delivered")]
    public async Task<IActionResult> CompleteStopDelivered(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        CancellationToken ct = default
    )
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null) return NotFound("Rota não encontrada.");

        var result = await _transitions.MarkDeliveredAsync(route, stopId, ct);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            deliveredAtUtc = result.Stop.DeliveredAtUtc,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString(),
            routeCompletedAtUtc = route.CompletedAtUtc
        });
    }

    // =========================================
    // PATCH /routes/{routeId}/stops/{stopId}/fail
    // =========================================
    [HttpPatch("{routeId:guid}/stops/{stopId:guid}/fail")]
    public async Task<IActionResult> FailStop(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        [FromBody] FailRouteStopRequest req,
        CancellationToken ct = default
    )
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        if (req is null || string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest("Reason é obrigatório para marcar falha.");

        var route = await _db.Routes
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null) return NotFound("Rota não encontrada.");

        var result = await _transitions.MarkFailedAsync(route, stopId, req.Reason, ct);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            failedAtUtc = result.Stop.FailedAtUtc,
            reason = result.Stop.FailureReason,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString(),
            routeCompletedAtUtc = route.CompletedAtUtc
        });
    }

    // =========================================
    // PATCH /routes/{routeId}/stops/{stopId}/skip
    // =========================================
    [HttpPatch("{routeId:guid}/stops/{stopId:guid}/skip")]
    public async Task<IActionResult> SkipStop(
        [FromRoute] Guid routeId,
        [FromRoute] Guid stopId,
        [FromBody] SkipRouteStopRequest? req,
        CancellationToken ct = default
    )
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        var route = await _db.Routes
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null) return NotFound("Rota não encontrada.");

        var result = _transitions.MarkSkipped(route, stopId, req?.Reason);
        if (!result.Success)
            return BadRequest(result.Error);

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            routeId = route.Id,
            stopId = result.Stop!.Id,
            stopStatus = result.Stop.Status.ToString(),
            reason = result.Stop.FailureReason,
            routeCompleted = result.RouteCompleted,
            routeStatus = route.Status.ToString(),
            routeCompletedAtUtc = route.CompletedAtUtc
        });
    }

    // =========================================
    // PATCH /routes/{routeId}/cancel
    // =========================================
    [HttpPatch("{routeId:guid}/cancel")]
    public async Task<IActionResult> CancelRoute(
        [FromRoute] Guid routeId,
        [FromBody] CancelRouteRequest req,
        CancellationToken ct = default
    )
    {
        var gate = RequireAdmin();
        if (gate != null) return gate;

        if (req is null || string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest("Reason é obrigatório para cancelar rota.");

        var route = await _db.Routes
            .Include(r => r.Stops)
            .FirstOrDefaultAsync(r => r.Id == routeId, ct);

        if (route is null) return NotFound("Rota não encontrada.");

        if (route.Status == RouteStatus.Concluida)
            return BadRequest("Rota já está concluída, não pode cancelar.");

        if (route.Status == RouteStatus.Cancelada)
            return BadRequest("Rota já está cancelada.");

        route.Status = RouteStatus.Cancelada;
        route.CompletedAtUtc = DateTime.UtcNow;

        // Regra: pedidos não finalizados voltam para PRONTO_PARA_ENTREGA
        var pendingOrderIds = route.Stops
            .Where(s => !RouteStopTransitionService.IsFinalStopStatus(s.Status))
            .Select(s => s.OrderId)
            .Distinct()
            .ToList();

        var orders = await _db.Orders
            .Where(o => pendingOrderIds.Contains(o.Id))
            .ToListAsync(ct);

        foreach (var o in orders)
        {
            if (o.Status == OrderStatus.SAIU_PARA_ENTREGA)
                o.Status = OrderStatus.PRONTO_PARA_ENTREGA;
        }

        // Guarda motivo no FailureReason das stops não finalizadas
        foreach (var s in route.Stops.Where(s => !RouteStopTransitionService.IsFinalStopStatus(s.Status)))
        {
            s.FailureReason = $"ROTA CANCELADA: {req.Reason.Trim()}";
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            routeId = route.Id,
            routeNumber = route.RouteNumber,
            status = route.Status.ToString(),
            cancelledAtUtc = route.CompletedAtUtc,
            reason = req.Reason.Trim(),
            revertedOrders = orders.Count
        });
    }
}
