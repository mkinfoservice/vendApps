namespace Petshop.Api.Services.Routes;

public class GeofencingService
{
    private readonly ILogger<GeofencingService> _logger;

    // Polígono da Vila Kennedy (coordenadas aproximadas)
    // IMPORTANTE: Para produção, obter coordenadas precisas do OpenStreetMap
    private static readonly List<(double lat, double lon)> VilaKennedyPolygon = new()
    {
        (-22.8525, -43.3750), // Nordeste
        (-22.8525, -43.3850), // Noroeste
        (-22.8650, -43.3850), // Sudoeste
        (-22.8650, -43.3750), // Sudeste
    };

    public GeofencingService(ILogger<GeofencingService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Verifica se coordenadas estão dentro de alguma zona de exclusão
    /// </summary>
    public bool IsInsideExclusionZone(double lat, double lon)
    {
        // Verifica Vila Kennedy
        if (IsPointInPolygon(lat, lon, VilaKennedyPolygon))
        {
            _logger.LogWarning("🚫 Coordenadas ({Lat:F6}, {Lon:F6}) estão dentro da VILA KENNEDY (zona de exclusão)",
                lat, lon);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Retorna lista de nomes das zonas de exclusão que contêm o ponto
    /// </summary>
    public List<string> GetExclusionZones(double lat, double lon)
    {
        var zones = new List<string>();

        if (IsPointInPolygon(lat, lon, VilaKennedyPolygon))
        {
            zones.Add("Vila Kennedy");
        }

        return zones;
    }

    /// <summary>
    /// Algoritmo Ray Casting para detectar se ponto está dentro de polígono.
    ///
    /// Lógica: Traça um raio horizontal a partir do ponto. Se o raio cruzar
    /// um número ímpar de arestas do polígono, o ponto está dentro.
    ///
    /// Referência: https://en.wikipedia.org/wiki/Point_in_polygon
    /// </summary>
    private static bool IsPointInPolygon(double lat, double lon, List<(double lat, double lon)> polygon)
    {
        if (polygon.Count < 3)
            return false; // Polígono precisa de no mínimo 3 pontos

        var inside = false;
        int j = polygon.Count - 1; // Último ponto

        for (int i = 0; i < polygon.Count; i++)
        {
            var (iLat, iLon) = polygon[i];
            var (jLat, jLon) = polygon[j];

            // Verifica se o raio horizontal a partir do ponto cruza a aresta [i, j]
            if ((iLat < lat && jLat >= lat || jLat < lat && iLat >= lat) &&
                (iLon <= lon || jLon <= lon))
            {
                // Calcula ponto de interseção do raio com a aresta
                var intersectionLon = iLon + (lat - iLat) / (jLat - iLat) * (jLon - iLon);

                // Se interseção está à esquerda do ponto, toggle inside
                if (intersectionLon < lon)
                    inside = !inside;
            }

            j = i; // Move para próxima aresta
        }

        return inside;
    }

    /// <summary>
    /// Adiciona um novo polígono de exclusão dinamicamente (para uso futuro)
    /// </summary>
    public bool IsPointInCustomPolygon(double lat, double lon, List<(double lat, double lon)> customPolygon)
    {
        return IsPointInPolygon(lat, lon, customPolygon);
    }
}
