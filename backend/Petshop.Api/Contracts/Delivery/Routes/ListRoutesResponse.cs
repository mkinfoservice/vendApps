namespace Petshop.Api.Contracts.Delivery.Routes;

public record ListRoutesResponse(
    int Page,
    int PageSize,
    int Total,
    List<RouteListItemResponse> Items
);