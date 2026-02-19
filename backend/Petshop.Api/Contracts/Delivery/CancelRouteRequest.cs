namespace Petshop.Api.Contracts.Delivery;

public class CancelRouteRequest
{
    public string? Reason { get; set; } = ""; // obrigatório (validação no controller)
}