namespace Petshop.Api.Contracts.Delivery;

/// <summary>
/// Links de navegação para abrir a rota no Waze ou Google Maps
/// </summary>
public sealed record NavigationLinksResponse
{
    /// <summary>
    /// Número da rota (ex: RT-20260215-001)
    /// </summary>
    public string RouteNumber { get; init; } = "";

    /// <summary>
    /// Total de stops na rota
    /// </summary>
    public int TotalStops { get; init; }

    /// <summary>
    /// Stops com coordenadas válidas
    /// </summary>
    public int StopsWithCoordinates { get; init; }

    /// <summary>
    /// Link para abrir no Waze (formato: waze://...)
    /// Abre o app Waze com navegação para o primeiro stop
    /// </summary>
    public string WazeLink { get; init; } = "";

    /// <summary>
    /// Link para abrir no Google Maps (formato: https://www.google.com/maps/dir/...)
    /// Abre Google Maps com rota completa (todos os stops)
    /// </summary>
    public string GoogleMapsLink { get; init; } = "";

    /// <summary>
    /// Link alternativo do Google Maps para web/desktop
    /// </summary>
    public string GoogleMapsWebLink { get; init; } = "";

    /// <summary>
    /// Lista de stops em ordem
    /// </summary>
    public List<NavigationStopInfo> Stops { get; init; } = new();

    /// <summary>
    /// Avisos (ex: alguns stops sem coordenadas)
    /// </summary>
    public List<string> Warnings { get; init; } = new();
}

/// <summary>
/// Informações de um stop para navegação
/// </summary>
public sealed record NavigationStopInfo
{
    public int Sequence { get; init; }
    public string OrderNumber { get; init; } = "";
    public string CustomerName { get; init; } = "";
    public string Address { get; init; } = "";
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public bool HasCoordinates { get; init; }
}
