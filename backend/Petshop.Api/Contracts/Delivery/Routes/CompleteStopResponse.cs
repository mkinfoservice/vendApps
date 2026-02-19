namespace Petshop.Api.Contracts.Delivery.Routes;

public record CompleteStopResponse(
    Guid RouteId,
    Guid StopId,
    string OldStatus,
    string Newstatus,
    DateTime DeliveredAtUtc,
    bool RouteCompleted,
    DateTime? RouteCompletedAtUtc
);