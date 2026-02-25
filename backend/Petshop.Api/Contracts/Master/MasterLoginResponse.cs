namespace Petshop.Api.Contracts.Master;

public record MasterLoginResponse(string Token, string Role, DateTime ExpiresAt);
