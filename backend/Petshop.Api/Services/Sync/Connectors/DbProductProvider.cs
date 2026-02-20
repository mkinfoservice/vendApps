namespace Petshop.Api.Services.Sync.Connectors;

/// <summary>
/// Conector de banco de dados relacional (MySQL, PostgreSQL, SQL Server, Oracle, Firebird).
/// Stub — implementação futura via Dapper + provider factory.
/// ConnectionConfigEncrypted: { "Provider": "MySql", "ConnectionString": "..." }
/// </summary>
public class DbProductProvider : IProductProvider
{
    public string ProviderName => "DB (stub)";

    public Task<ProviderCapabilities> GetCapabilitiesAsync(CancellationToken ct) =>
        Task.FromResult(new ProviderCapabilities
        {
            SupportsDelta = true,
            SupportsHashCheck = false,
            SupportsImages = false
        });

    public Task<IReadOnlyList<ExternalProductDto>> FetchProductsAsync(ExternalProductQuery query, CancellationToken ct)
        => throw new NotImplementedException("Conector DB ainda não implementado. Use CSV ou REST por enquanto.");

    public Task<(bool Success, string Message, int SampleCount)> TestConnectionAsync(CancellationToken ct)
        => Task.FromResult((false, "Conector DB ainda não implementado.", 0));
}
