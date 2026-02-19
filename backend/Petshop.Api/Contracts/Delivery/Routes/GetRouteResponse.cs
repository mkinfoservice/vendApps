namespace Petshop.Api.Contracts.Delivery.Routes;

public record GetRouteResponse(
    Guid Id,
    string RouteNumber,
    string Status,
    int TotalStops,
    Guid? DelivererId,
    string? DelivererName,
    string? DelivererPhone,
    string? DelivererVehicle,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    List<RouteStopResponse> Stops
);