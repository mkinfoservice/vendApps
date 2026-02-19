namespace Petshop.Api.Contracts.Orders;

public record ListReadyOrdersResponse(int Total, IReadOnlyList<ReadyOrderItemResponse> Items);
