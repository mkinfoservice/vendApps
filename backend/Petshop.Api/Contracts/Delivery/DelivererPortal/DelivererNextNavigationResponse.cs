namespace Petshop.Api.Contracts.Delivery.DelivererPortal;

public class DelivererNextNavigationResponse
{
    public Guid? NextStopId { get; set; }
    public string? CustomerName { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? WazeLink { get; set; }
    public string? GoogleMapsLink { get; set; }
    public bool HasCoordinates { get; set; }
    public bool RouteCompleted { get; set; }
}
