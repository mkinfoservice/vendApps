namespace Petshop.Api.Contracts.Delivery.Routes.Preview;

public sealed record PreviewRouteResponse
{
    public PreviewRouteDto? RouteA { get; init; }
    public PreviewRouteDto? RouteB { get; init; }
    public List<PreviewOrderDto> UnknownOrders { get; init; } = new();
    public List<string> Warnings { get; init; } = new();
    public PreviewSummary Summary { get; init; } = new();
}

public sealed record PreviewSummary
{
    public int TotalOrdersRequested { get; init; }
    public int TotalOrdersValid { get; init; }
    public int RouteAStops { get; init; }
    public int RouteBStops { get; init; }
    public string DepotAddress { get; init; } = "";
    public double DeliveryRadiusKm { get; init; }
}
