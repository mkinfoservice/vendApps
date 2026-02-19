using Microsoft.Extensions.Configuration;
using Petshop.Api.Entities;

namespace Petshop.Api.Services.Routes;

public class DepotService
{
    private readonly IConfiguration _config;
    private readonly ILogger<DepotService> _logger;

    public DepotService(IConfiguration config, ILogger<DepotService> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Obtém as coordenadas do depot configurado em appsettings.json
    /// </summary>
    public (double lat, double lon) GetDepotCoordinates()
    {
        var lat = _config.GetValue<double>("Geocoding:Depot:Latitude");
        var lon = _config.GetValue<double>("Geocoding:Depot:Longitude");

        if (lat == 0 || lon == 0)
        {
            _logger.LogWarning("📍 Depot não configurado corretamente em appsettings.json (Geocoding:Depot)");
            throw new InvalidOperationException("Depot não configurado. Verifique appsettings.json -> Geocoding:Depot");
        }

        return (lat, lon);
    }

    /// <summary>
    /// Obtém o endereço legível do depot
    /// </summary>
    public string GetDepotAddress()
    {
        var address = _config.GetValue<string>("Geocoding:Depot:Address") ?? "Depot não configurado";
        return address;
    }

    /// <summary>
    /// Obtém o raio de entrega configurado (padrão: 11km)
    /// </summary>
    public double GetDeliveryRadiusKm()
    {
        return _config.GetValue<double?>("Geocoding:Depot:RadiusKm") ?? 11.0;
    }

    /// <summary>
    /// Verifica se pedido está dentro do raio de entrega a partir do depot
    /// </summary>
    public bool IsWithinDeliveryRadius(Order order, double? radiusKm = null)
    {
        if (!order.Latitude.HasValue || !order.Longitude.HasValue)
        {
            _logger.LogWarning("📍 Pedido {OrderId} ({PublicId}) não possui coordenadas para validar raio",
                order.Id, order.PublicId);
            return false;
        }

        var radius = radiusKm ?? GetDeliveryRadiusKm();
        var distance = GetDistanceFromDepot(order.Latitude.Value, order.Longitude.Value);

        var isWithin = distance <= radius;

        if (!isWithin)
        {
            _logger.LogWarning("🚫 Pedido {OrderId} ({PublicId}) está FORA do raio de entrega: {Distance:F2}km > {Radius:F2}km",
                order.Id, order.PublicId, distance, radius);
        }
        else
        {
            _logger.LogDebug("✅ Pedido {OrderId} ({PublicId}) está DENTRO do raio: {Distance:F2}km <= {Radius:F2}km",
                order.Id, order.PublicId, distance, radius);
        }

        return isWithin;
    }

    /// <summary>
    /// Calcula distância em km de coordenadas até o depot usando fórmula de Haversine
    /// </summary>
    public double GetDistanceFromDepot(double lat, double lon)
    {
        var depot = GetDepotCoordinates();
        return HaversineKm(depot.lat, depot.lon, lat, lon);
    }

    /// <summary>
    /// Fórmula de Haversine para calcular distância entre dois pontos em km
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
