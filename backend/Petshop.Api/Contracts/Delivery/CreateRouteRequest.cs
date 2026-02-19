namespace Petshop.Api.Contracts.Delivery;

public class CreateRouteRequest
{
    public Guid DelivererId { get; set; }
    public List<Guid> OrderIds { get; set; } = new();

    /// <summary>
    /// Opcional: filtrar apenas pedidos do lado "A" ou "B".
    /// Se null, cria rota com todos os pedidos (comportamento original).
    /// </summary>
    public string? RouteSide { get; set; }
}