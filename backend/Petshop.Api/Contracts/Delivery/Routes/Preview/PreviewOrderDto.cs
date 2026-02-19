namespace Petshop.Api.Contracts.Delivery.Routes.Preview;

public sealed record PreviewOrderDto
{
    public Guid OrderId { get; init; }
    public string OrderNumber { get; init; } = "";
    public string CustomerName { get; init; } = "";
    public string Address { get; init; } = "";
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public int Sequence { get; init; }
    public string Classification { get; init; } = ""; // "A", "B", "Unknown"
    public double DistanceFromDepotKm { get; init; }
}
