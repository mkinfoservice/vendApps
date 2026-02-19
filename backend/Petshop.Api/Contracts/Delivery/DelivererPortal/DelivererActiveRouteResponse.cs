namespace Petshop.Api.Contracts.Delivery.DelivererPortal;

public class DelivererActiveRouteResponse
{
    public bool HasActiveRoute { get; set; }
    public Guid? RouteId { get; set; }
    public string? RouteNumber { get; set; }
    public string? Status { get; set; }
    public int TotalStops { get; set; }
    public int CompletedStops { get; set; }
    public int RemainingStops { get; set; }
    public DelivererStopDto? NextStop { get; set; }
}
