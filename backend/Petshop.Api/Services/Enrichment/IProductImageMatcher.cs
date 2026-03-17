namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Interface para provedores de matching de imagem.
/// Extensível: adicionar novos provedores sem alterar o orquestrador.
/// </summary>
public interface IProductImageMatcher
{
    Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default);
}
