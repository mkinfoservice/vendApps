namespace Petshop.Api.Contracts.Auth;

public record DelivererLoginResponse(string Token, Guid DelivererId, string Name);
