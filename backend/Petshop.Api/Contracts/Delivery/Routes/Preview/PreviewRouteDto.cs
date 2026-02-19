namespace Petshop.Api.Contracts.Delivery.Routes.Preview;

public sealed record PreviewRouteDto
{
    public string Side { get; init; } = ""; // "A" ou "B"
    public string Direction { get; init; } = ""; // "Nordeste/Leste" ou "Oeste/Noroeste"
    public int TotalStops { get; init; }
    public double EstimatedDistanceKm { get; init; }
    public List<PreviewOrderDto> Orders { get; init; } = new();
}
