using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Delivery.Routes.Preview;
using Petshop.Api.Data;
using Petshop.Api.Entities;

namespace Petshop.Api.Services.Routes;

public class RoutePreviewService
{
    private readonly AppDbContext _db;
    private readonly DepotService _depot;
    private readonly GeofencingService _geofencing;
    private readonly NeighborhoodClassificationService _classification;
    private readonly RouteOptimizationService _optimizer;
    private readonly ILogger<RoutePreviewService> _logger;

    public RoutePreviewService(
        AppDbContext db,
        DepotService depot,
        GeofencingService geofencing,
        NeighborhoodClassificationService classification,
        RouteOptimizationService optimizer,
        ILogger<RoutePreviewService> logger)
    {
        _db = db;
        _depot = depot;
        _geofencing = geofencing;
        _classification = classification;
        _optimizer = optimizer;
        _logger = logger;
    }

    /// <summary>
    /// Gera preview de rotas bidirecionais (A e B) sem salvar no banco.
    /// </summary>
    public async Task<PreviewRouteResponse> PreviewRoutesAsync(
        List<Guid> orderIds,
        CancellationToken ct = default)
    {
        _logger.LogInformation("🗺️ Iniciando preview de rotas para {Count} pedidos", orderIds.Count);

        // 1. Buscar Orders do banco
        var orders = await _db.Orders
            .Where(o => orderIds.Contains(o.Id))
            .ToListAsync(ct);

        if (orders.Count == 0)
        {
            _logger.LogWarning("⚠️ Nenhum pedido encontrado para preview");
            return new PreviewRouteResponse
            {
                Warnings = new List<string> { "⚠️ Nenhum pedido encontrado" },
                Summary = new PreviewSummary
                {
                    TotalOrdersRequested = orderIds.Count,
                    DepotAddress = _depot.GetDepotAddress(),
                    DeliveryRadiusKm = _depot.GetDeliveryRadiusKm()
                }
            };
        }

        // 2. Filtrar pedidos válidos
        var (validOrders, warnings) = FilterOrders(orders);

        if (validOrders.Count == 0)
        {
            _logger.LogWarning("⚠️ Nenhum pedido válido após filtros");
            return new PreviewRouteResponse
            {
                Warnings = warnings,
                Summary = new PreviewSummary
                {
                    TotalOrdersRequested = orderIds.Count,
                    TotalOrdersValid = 0,
                    DepotAddress = _depot.GetDepotAddress(),
                    DeliveryRadiusKm = _depot.GetDeliveryRadiusKm()
                }
            };
        }

        // 3. Classificar em A/B/Unknown
        var routeAOrders = new List<Order>();
        var routeBOrders = new List<Order>();
        var unknownOrders = new List<Order>();

        foreach (var order in validOrders)
        {
            var classification = _classification.ClassifyOrder(order);

            if (classification == "A")
                routeAOrders.Add(order);
            else if (classification == "B")
                routeBOrders.Add(order);
            else
                unknownOrders.Add(order);
        }

        _logger.LogInformation("🗺️ Classificação: Rota A={CountA}, Rota B={CountB}, Unknown={CountUnknown}",
            routeAOrders.Count, routeBOrders.Count, unknownOrders.Count);

        // 4. Otimizar cada rota com depot como ponto de partida
        //    Cada rota é independente: se uma falhar, a outra continua
        var depot = _depot.GetDepotCoordinates();

        PreviewRouteDto? routeAPreview = null;
        PreviewRouteDto? routeBPreview = null;

        if (routeAOrders.Count > 0)
        {
            try
            {
                var optimizedA = await _optimizer.OptimizeWithDepotAsync(routeAOrders, depot, ct);
                routeAPreview = BuildRoutePreview("A", optimizedA);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ Falha ao otimizar Rota A, usando ordem por proximidade simples");
                routeAPreview = BuildRoutePreview("A", routeAOrders);
                warnings.Add("⚠️ Rota A: otimização falhou, usando ordem simplificada");
            }
        }

        // Pequeno delay para evitar rate limit do ORS Matrix API
        if (routeAOrders.Count > 0 && routeBOrders.Count > 0)
        {
            await Task.Delay(500, ct);
        }

        if (routeBOrders.Count > 0)
        {
            try
            {
                var optimizedB = await _optimizer.OptimizeWithDepotAsync(routeBOrders, depot, ct);
                routeBPreview = BuildRoutePreview("B", optimizedB);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ Falha ao otimizar Rota B, usando ordem por proximidade simples");
                routeBPreview = BuildRoutePreview("B", routeBOrders);
                warnings.Add("⚠️ Rota B: otimização falhou, usando ordem simplificada");
            }
        }

        // 5. Montar lista de pedidos desconhecidos
        var unknownDtos = unknownOrders
            .Select((o, idx) => BuildOrderDto(o, idx + 1, "Unknown"))
            .ToList();

        // 6. Montar resposta
        return new PreviewRouteResponse
        {
            RouteA = routeAPreview,
            RouteB = routeBPreview,
            UnknownOrders = unknownDtos,
            Warnings = warnings,
            Summary = new PreviewSummary
            {
                TotalOrdersRequested = orderIds.Count,
                TotalOrdersValid = validOrders.Count,
                RouteAStops = routeAOrders.Count,
                RouteBStops = routeBOrders.Count,
                DepotAddress = _depot.GetDepotAddress(),
                DeliveryRadiusKm = _depot.GetDeliveryRadiusKm()
            }
        };
    }

    /// <summary>
    /// Filtra pedidos aplicando validações de status, coordenadas, raio e zona de exclusão.
    /// Retorna pedidos válidos e lista de warnings.
    /// </summary>
    private (List<Order> valid, List<string> warnings) FilterOrders(List<Order> orders)
    {
        var valid = new List<Order>();
        var warnings = new List<string>();

        foreach (var order in orders)
        {
            // Valida status
            if (order.Status != OrderStatus.PRONTO_PARA_ENTREGA)
            {
                warnings.Add($"⚠️ Pedido {order.PublicId} não está PRONTO_PARA_ENTREGA (status: {order.Status})");
                _logger.LogWarning("⚠️ Pedido {OrderId} ({PublicId}) com status inválido: {Status}",
                    order.Id, order.PublicId, order.Status);
                continue;
            }

            // Valida coordenadas
            if (!order.Latitude.HasValue || !order.Longitude.HasValue)
            {
                warnings.Add($"⚠️ Pedido {order.PublicId} não possui coordenadas (geocoding pendente)");
                _logger.LogWarning("⚠️ Pedido {OrderId} ({PublicId}) sem coordenadas",
                    order.Id, order.PublicId);
                continue;
            }

            // Valida raio de entrega
            if (!_depot.IsWithinDeliveryRadius(order))
            {
                var distanceKm = _depot.GetDistanceFromDepot(order.Latitude.Value, order.Longitude.Value);
                warnings.Add($"🚫 Pedido {order.PublicId} está FORA do raio de {_depot.GetDeliveryRadiusKm():F1}km (distância: {distanceKm:F2}km)");
                continue;
            }

            // Valida exclusão de zona
            if (_geofencing.IsInsideExclusionZone(order.Latitude.Value, order.Longitude.Value))
            {
                var zones = _geofencing.GetExclusionZones(order.Latitude.Value, order.Longitude.Value);
                warnings.Add($"🚫 Pedido {order.PublicId} está em ZONA DE EXCLUSÃO ({string.Join(", ", zones)})");
                continue;
            }

            valid.Add(order);
        }

        _logger.LogInformation("✅ {ValidCount}/{TotalCount} pedidos válidos após filtros",
            valid.Count, orders.Count);

        return (valid, warnings);
    }

    /// <summary>
    /// Monta PreviewRouteDto a partir de lista de pedidos otimizados.
    /// </summary>
    private PreviewRouteDto BuildRoutePreview(string side, List<Order> optimizedOrders)
    {
        var orderDtos = optimizedOrders
            .Select((o, idx) => BuildOrderDto(o, idx + 1, side))
            .ToList();

        // Calcular distância total estimada (soma das distâncias entre paradas)
        double totalDistanceKm = 0;
        var depot = _depot.GetDepotCoordinates();

        if (optimizedOrders.Count > 0 && optimizedOrders[0].Latitude.HasValue)
        {
            // Distância do depot até primeira parada
            totalDistanceKm += HaversineKm(
                depot.lat, depot.lon,
                optimizedOrders[0].Latitude!.Value, optimizedOrders[0].Longitude!.Value
            );

            // Distâncias entre paradas consecutivas
            for (int i = 0; i < optimizedOrders.Count - 1; i++)
            {
                if (optimizedOrders[i].Latitude.HasValue && optimizedOrders[i + 1].Latitude.HasValue)
                {
                    totalDistanceKm += HaversineKm(
                        optimizedOrders[i].Latitude!.Value, optimizedOrders[i].Longitude!.Value,
                        optimizedOrders[i + 1].Latitude!.Value, optimizedOrders[i + 1].Longitude!.Value
                    );
                }
            }
        }

        return new PreviewRouteDto
        {
            Side = side,
            Direction = _classification.GetDirectionName(side),
            TotalStops = optimizedOrders.Count,
            EstimatedDistanceKm = totalDistanceKm,
            Orders = orderDtos
        };
    }

    /// <summary>
    /// Monta PreviewOrderDto a partir de Order.
    /// </summary>
    private PreviewOrderDto BuildOrderDto(Order order, int sequence, string classification)
    {
        double distanceFromDepot = 0;

        if (order.Latitude.HasValue && order.Longitude.HasValue)
        {
            var depot = _depot.GetDepotCoordinates();
            distanceFromDepot = HaversineKm(depot.lat, depot.lon, order.Latitude.Value, order.Longitude.Value);
        }

        return new PreviewOrderDto
        {
            OrderId = order.Id,
            OrderNumber = order.PublicId,
            CustomerName = order.CustomerName,
            Address = order.Address,
            Latitude = order.Latitude,
            Longitude = order.Longitude,
            Sequence = sequence,
            Classification = classification,
            DistanceFromDepotKm = distanceFromDepot
        };
    }

    /// <summary>
    /// Fórmula de Haversine (reutilizada de RouteOptimizationService)
    /// </summary>
    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0; // Raio da Terra em km
        static double ToRad(double deg) => deg * (Math.PI / 180.0);

        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);

        var a =
            Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
            Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }
}
