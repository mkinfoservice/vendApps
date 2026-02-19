namespace Petshop.Api.Contracts.Delivery.Routes;

public record RouteStopResponse(
    Guid StopId,
    int Sequence,
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    string CustomerPhone,
    string Address,
    string Status,
    DateTime? DeliveredAtUtc
);