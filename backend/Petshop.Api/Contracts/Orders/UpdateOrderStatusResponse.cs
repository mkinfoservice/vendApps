namespace Petshop.Api.Contracts.Orders;

public sealed record UpdateOrderStatusResponse(
    Guid Id,
    string OrderNumber,
    string OldStatus,
    string NewStatus,
    DateTime UpdateAtUtc

);