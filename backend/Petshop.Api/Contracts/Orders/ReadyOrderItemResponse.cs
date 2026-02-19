namespace Petshop.Api.Contracts.Orders;

public record ReadyOrderItemResponse(
    Guid Id,
    string OrderNumber,
    string CustomerName,
    string Phone,
    string Cep,
    string Address,
    int TotalCents,
    DateTime CreatedAtUtc,
    double? Latitude,
    double? Longitude
);
