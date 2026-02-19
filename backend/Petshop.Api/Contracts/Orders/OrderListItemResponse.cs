namespace Petshop.Api.Contracts.Orders;

public sealed record OrderListItemResponse(
    Guid Id,
    string OrderNumber,
    string CustomerName,
    string Phone,
    string Status,
    int TotalCents,
    string PaymentMethodStr,
    DateTime CreatedAtUtc
);
