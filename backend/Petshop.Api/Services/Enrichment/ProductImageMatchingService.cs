namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Orquestra múltiplos matchers de imagem e agrega os candidatos.
/// Atualmente usa apenas OpenFoodFactsClient (extensível via IProductImageMatcher).
/// </summary>
public sealed class ProductImageMatchingService
{
    private readonly IEnumerable<IProductImageMatcher> _matchers;
    private readonly ILogger<ProductImageMatchingService> _logger;

    public ProductImageMatchingService(
        IEnumerable<IProductImageMatcher> matchers,
        ILogger<ProductImageMatchingService> logger)
    {
        _matchers = matchers;
        _logger   = logger;
    }

    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        var all = new List<ImageMatchCandidate>();

        foreach (var matcher in _matchers)
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                var results = await matcher.FindCandidatesAsync(input, ct);
                all.AddRange(results);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Matcher {Type} falhou para produto {ProductId}",
                    matcher.GetType().Name, input.ProductId);
            }
        }

        return all;
    }
}
