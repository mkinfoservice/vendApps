namespace Petshop.Api.Contracts.Delivery;

public class FailRouteStopRequest
{
    public string? Reason { get; set; } = ""; // obrigatório (validação no controller)
}