using Petshop.Api.Entities;

namespace Petshop.Api.Services.Routes;

public class NeighborhoodClassificationService
{
    private readonly DepotService _depot;
    private readonly ILogger<NeighborhoodClassificationService> _logger;

    public NeighborhoodClassificationService(
        DepotService depot,
        ILogger<NeighborhoodClassificationService> logger)
    {
        _depot = depot;
        _logger = logger;
    }

    /// <summary>
    /// Classifica pedido em Rota A ou B baseado no azimute (bearing) a partir do depot.
    ///
    /// O círculo de 360° é dividido em 2 metades SEM buracos:
    /// - Rota A (0° a 180°): Leste do depot → Senador Camará, Santíssimo, Campo Grande (via Av. Santa Cruz)
    /// - Rota B (180° a 360°): Oeste do depot → Padre Miguel, Realengo
    /// - Unknown: apenas quando não tem coordenadas (impossível classificar)
    ///
    /// Vila Kennedy é bloqueada pelo GeofencingService ANTES desta classificação.
    /// </summary>
    /// <returns>"A", "B" ou "Unknown"</returns>
    public string ClassifyOrder(Order order)
    {
        if (!order.Latitude.HasValue || !order.Longitude.HasValue)
        {
            _logger.LogWarning("🗺️ Pedido {OrderId} ({PublicId}) não possui coordenadas para classificar",
                order.Id, order.PublicId);
            return "Unknown";
        }

        var depot = _depot.GetDepotCoordinates();
        var bearing = CalculateBearing(depot, (order.Latitude.Value, order.Longitude.Value));

        // Divisão simples: Leste (0-180°) = A, Oeste (180-360°) = B
        // Sem buracos — todo pedido com coordenadas é classificado
        var classification = bearing < 180 ? "A" : "B";

        _logger.LogInformation("🗺️ Pedido {OrderId} ({PublicId}): bearing {Bearing:F1}° → Rota {Classification}",
            order.Id, order.PublicId, bearing, classification);

        return classification;
    }

    /// <summary>
    /// Obtém direção legível baseada na classificação
    /// </summary>
    public string GetDirectionName(string classification)
    {
        return classification switch
        {
            "A" => "Leste (Senador Camará/Santíssimo/Campo Grande)",
            "B" => "Oeste (Padre Miguel/Realengo)",
            _ => "Sem coordenadas"
        };
    }

    /// <summary>
    /// Calcula o azimute (bearing) de origem para destino.
    ///
    /// Retorna ângulo em graus (0-360):
    /// - 0° = Norte
    /// - 90° = Leste
    /// - 180° = Sul
    /// - 270° = Oeste
    ///
    /// Fórmula: https://www.movable-type.co.uk/scripts/latlong.html
    /// </summary>
    private static double CalculateBearing(
        (double lat, double lon) origin,
        (double lat, double lon) destination)
    {
        const double DegreesToRadians = Math.PI / 180.0;
        const double RadiansToDegrees = 180.0 / Math.PI;

        var lat1 = origin.lat * DegreesToRadians;
        var lat2 = destination.lat * DegreesToRadians;
        var dLon = (destination.lon - origin.lon) * DegreesToRadians;

        var y = Math.Sin(dLon) * Math.Cos(lat2);
        var x = Math.Cos(lat1) * Math.Sin(lat2) -
                Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLon);

        var bearing = Math.Atan2(y, x) * RadiansToDegrees;

        // Normaliza para 0-360°
        return (bearing + 360.0) % 360.0;
    }

    /// <summary>
    /// Método auxiliar para testes: calcula bearing entre duas coordenadas quaisquer
    /// </summary>
    public double CalculateBearingFromDepot(double destLat, double destLon)
    {
        var depot = _depot.GetDepotCoordinates();
        return CalculateBearing(depot, (destLat, destLon));
    }
}
