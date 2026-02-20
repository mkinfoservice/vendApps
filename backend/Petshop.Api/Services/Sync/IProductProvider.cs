namespace Petshop.Api.Services.Sync;

/// <summary>
/// Contrato de todos os conectores de produtos externos.
/// Cada implementação traduz sua origem (CSV, REST ERP, DB, etc.) para ExternalProductDto.
/// </summary>
public interface IProductProvider
{
    string ProviderName { get; }

    Task<ProviderCapabilities> GetCapabilitiesAsync(CancellationToken ct);

    /// <summary>
    /// Busca produtos da origem externa conforme a query.
    /// Retorna lista vazia se não há produtos para a página/filtro informados.
    /// </summary>
    Task<IReadOnlyList<ExternalProductDto>> FetchProductsAsync(ExternalProductQuery query, CancellationToken ct);

    /// <summary>Testa a conexão sem importar dados. Retorna (success, message, sampleCount).</summary>
    Task<(bool Success, string Message, int SampleCount)> TestConnectionAsync(CancellationToken ct);
}
