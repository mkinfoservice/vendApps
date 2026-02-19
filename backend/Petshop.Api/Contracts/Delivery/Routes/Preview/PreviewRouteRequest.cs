namespace Petshop.Api.Contracts.Delivery.Routes.Preview;

public sealed record PreviewRouteRequest
{
    public List<Guid> OrderIds { get; init; } = new();
}
