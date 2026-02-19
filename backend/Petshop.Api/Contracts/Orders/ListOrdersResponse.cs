namespace Petshop.Api.Contracts.Orders;

public sealed record ListOrdersResponse(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyList<OrderListItemResponse> Items
);
