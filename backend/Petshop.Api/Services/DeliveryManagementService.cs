using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Delivery;
using Petshop.Api.Services.Routes;

namespace Petshop.Api.Services;

public class DeliveryManagementService
{
    private readonly AppDbContext _db;
    private readonly RouteOptimizationService _optimizer;
    private readonly DepotService _depot;
    private readonly GeofencingService _geofencing;
    private readonly RouteSideValidator _routeSideValidator;
    private readonly ILogger<DeliveryManagementService> _logger;

    public DeliveryManagementService(
        AppDbContext db,
        RouteOptimizationService optimizer,
        DepotService depot,
        GeofencingService geofencing,
        RouteSideValidator routeSideValidator,
        ILogger<DeliveryManagementService> logger)
    {
        _db = db;
        _optimizer = optimizer;
        _depot = depot;
        _geofencing = geofencing;
        _routeSideValidator = routeSideValidator;
        _logger = logger;
    }

    public async Task<Petshop.Api.Entities.Delivery.Route> CreateRouteAsync(
        Guid delivererId,
        List<Guid> orderIds,
        string? routeSide = null,
        CancellationToken ct = default
    )
    {
        if (orderIds is null || orderIds.Count == 0)
            throw new Exception("Nenhum pedido informado.");

        var deliverer = await _db.Deliverers.FirstOrDefaultAsync(d => d.Id == delivererId, ct);
        if (deliverer is null) throw new Exception("Entregador não encontrado.");
        if (!deliverer.IsActive) throw new Exception("Entregador está inativo.");

        var orders = await _db.Orders
            .Where(o => orderIds.Contains(o.Id))
            .ToListAsync(ct);

        if (orders.Count == 0)
            throw new Exception("Nenhum pedido válido encontrado.");

        if (orders.Count != orderIds.Distinct().Count())
            throw new Exception("Um ou mais pedidos não foram encontrados no banco.");

        foreach (var o in orders)
        {
            if (o.Status != OrderStatus.PRONTO_PARA_ENTREGA)
                throw new Exception($"Pedido {o.PublicId} não está pronto para entrega.");
        }

        // ✅ VALIDAÇÕES DE ROTEAMENTO BIDIRECIONAL
        var validOrders = new List<Order>();

        foreach (var order in orders)
        {
            // Validar coordenadas
            if (!order.Latitude.HasValue || !order.Longitude.HasValue)
            {
                _logger.LogWarning("⚠️ Pedido {OrderId} ({PublicId}) não possui coordenadas, será ignorado",
                    order.Id, order.PublicId);
                continue;
            }

            // Validar raio de entrega
            if (!_depot.IsWithinDeliveryRadius(order))
            {
                var distanceKm = _depot.GetDistanceFromDepot(order.Latitude.Value, order.Longitude.Value);
                throw new Exception($"Pedido {order.PublicId} está fora do raio de entrega ({distanceKm:F2}km > {_depot.GetDeliveryRadiusKm():F1}km)");
            }

            // Validar zona de exclusão
            if (_geofencing.IsInsideExclusionZone(order.Latitude.Value, order.Longitude.Value))
            {
                var zones = _geofencing.GetExclusionZones(order.Latitude.Value, order.Longitude.Value);
                throw new Exception($"Pedido {order.PublicId} está em zona de exclusão ({string.Join(", ", zones)})");
            }

            validOrders.Add(order);
        }

        if (validOrders.Count == 0)
            throw new Exception("Nenhum pedido válido para criar rota após validações.");

        // Filtrar por RouteSide (A ou B) se fornecido
        if (!string.IsNullOrWhiteSpace(routeSide))
        {
            var (sidedOrders, sideWarnings) = _routeSideValidator.FilterByRouteSide(validOrders, routeSide);

            if (sidedOrders.Count == 0)
                throw new Exception($"Nenhum pedido classificado como Rota {routeSide} encontrado.");

            validOrders = sidedOrders;

            _logger.LogInformation("✅ {Count} pedidos filtrados para Rota {Side}", validOrders.Count, routeSide);
        }

        // ✅ PASSO 7: ordenação inteligente com ORS Matrix API
        // RouteOptimizationService agora usa:
        // - ORS Matrix API para tempo real de trajeto (se disponível)
        // - Fallback para Haversine se Matrix API falhar
        // - Depot como ponto de partida (se RouteSide fornecido)
        // - Otimiza com greedy nearest neighbor
        _logger.LogInformation("Criando rota com {Count} pedidos. Delegando otimização para RouteOptimizationService (com Matrix API).",
            validOrders.Count);

        // Se RouteSide fornecido, usar otimização com depot como ponto de partida
        List<Order> optimized;
        if (!string.IsNullOrWhiteSpace(routeSide))
        {
            var depot = _depot.GetDepotCoordinates();
            _logger.LogInformation("🗺️ Otimizando Rota {Side} com depot como ponto de partida", routeSide);
            optimized = await _optimizer.OptimizeWithDepotAsync(validOrders, depot, ct);
        }
        else
        {
            // Comportamento original (sem depot fixo)
            optimized = await _optimizer.OptimizeWithMatrixAsync(validOrders, ct);
        }

        var route = new Petshop.Api.Entities.Delivery.Route
        {
            Id = Guid.NewGuid(),
            RouteNumber = $"RT-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(100, 999)}",
            DelivererId = deliverer.Id,
            Status = RouteStatus.Criada,
            CreatedAtUtc = DateTime.UtcNow
        };

        var sequence = 1;

        foreach (var o in optimized)
        {
            var stopStatus = sequence == 1 ? RouteStopStatus.Proxima : RouteStopStatus.Pendente;

            route.Stops.Add(new RouteStop
            {
                Id = Guid.NewGuid(),
                RouteId = route.Id,
                OrderId = o.Id,
                Sequence = sequence,
                Status = stopStatus,

                OrderNumberSnapshot = o.PublicId,
                CustomerNameSnapshot = o.CustomerName,
                CustomerPhoneSnapshot = o.Phone,
                AddressSnapshot = $"{o.Address} - CEP: {o.Cep}"
            });

            o.Status = OrderStatus.SAIU_PARA_ENTREGA;
            sequence++;
        }

        route.TotalStops = route.Stops.Count;

        _db.Routes.Add(route);
        await _db.SaveChangesAsync(ct);

        return route;
    }
}
