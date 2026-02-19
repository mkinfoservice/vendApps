namespace Petshop.Api.Contracts.Delivery.Routes;

public record RouteListItemResponse(
    Guid Id,
    string RouteNumber,
    string Status,
    int TotalStops,
    string? DelivererName,
    string? DelivererVehicle,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc
);