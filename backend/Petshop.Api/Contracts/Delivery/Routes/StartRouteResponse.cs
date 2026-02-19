namespace Petshop.Api.Contracts.Delivery.Routes;

public record StartRouteResponse(
    Guid RouteId,
    string RouteNumber,
    string OldStatus,
    string NewStatus,
    DateTime StartedAtUtc
);