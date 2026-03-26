using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs de busca por nome ────────────────────────────────────────────────────

internal record OffSearchResponse(
    [property: JsonPropertyName("products")] List<OffSearchProduct>? Products);

internal record OffSearchProduct(
    [property: JsonPropertyName("code")]            string? Code,
    [property: JsonPropertyName("product_name")]    string? ProductName,
    [property: JsonPropertyName("brands")]          string? Brands,
    [property: JsonPropertyName("image_front_url")] string? ImageFrontUrl,
    [property: JsonPropertyName("image_url")]       string? ImageUrl);

// ── Matcher ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem por nome do produto nas APIs Open Food Facts e Open Pet Food Facts.
/// Usado quando o produto não tem código de barras cadastrado.
/// Retorna até 3 candidatas das duas fontes combinadas.
/// </summary>
public sealed class ProductNameImageSearchMatcher : IProductImageMatcher
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ProductNameImageSearchMatcher> _logger;

    // Hosts das duas bases que pesquisamos
    private static readonly string[] SearchHosts =
    [
        "https://world.openpetfoodfacts.org",
        "https://world.openfoodfacts.org",
    ];

    public ProductNameImageSearchMatcher(
        IHttpClientFactory httpFactory,
        ILogger<ProductNameImageSearchMatcher> logger)
    {
        _httpFactory = httpFactory;
        _logger      = logger;
    }

    /// <summary>
    /// Versão para o picker manual: retorna List&lt;MlImageResult&gt; buscando por nome
    /// nas bases Open Pet Food Facts e Open Food Facts.
    /// </summary>
    public async Task<List<MlImageResult>> SearchForPickerAsync(string query, CancellationToken ct)
    {
        var q = BuildSearchQuery(query);
        if (string.IsNullOrWhiteSpace(q)) return [];

        var results = new List<MlImageResult>();

        foreach (var host in SearchHosts)
        {
            if (ct.IsCancellationRequested) break;
            if (results.Count >= 10) break;

            try
            {
                using var http = _httpFactory.CreateClient("EnrichmentNameSearch");
                var encoded    = HttpUtility.UrlEncode(q);
                var url        = $"{host}/cgi/search.pl?search_terms={encoded}&search_simple=1&action=process&json=1&fields=code,product_name,brands,image_front_url,image_url&page_size=5";

                var response = await http.GetFromJsonAsync<OffSearchResponse>(url, ct);
                if (response?.Products is null) continue;

                foreach (var p in response.Products)
                {
                    var imgUrl = p.ImageFrontUrl ?? p.ImageUrl;
                    if (string.IsNullOrWhiteSpace(imgUrl)) continue;
                    var name   = p.ProductName ?? p.Brands ?? query;
                    results.Add(new MlImageResult(p.Code ?? Guid.NewGuid().ToString(), name, [imgUrl]));
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Picker fallback falhou em {Host}", host);
            }
        }

        return results;
    }

    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        // Se já tem barcode, os outros matchers (OFF/OPFF por barcode) já cuidam
        if (!string.IsNullOrWhiteSpace(input.Barcode))
            return [];

        if (string.IsNullOrWhiteSpace(input.Name))
            return [];

        // Simplifica o nome: remove palavras muito curtas e limita a 5 tokens
        var query = BuildSearchQuery(input.Name);
        if (string.IsNullOrWhiteSpace(query))
            return [];

        var results = new List<ImageMatchCandidate>();

        foreach (var host in SearchHosts)
        {
            if (ct.IsCancellationRequested) break;
            if (results.Count >= 3) break;

            var source = host.Contains("petfood") ? "OpenPetFoodFacts-Name" : "OpenFoodFacts-Name";
            var candidates = await SearchByNameAsync(host, source, query, input, ct);
            results.AddRange(candidates);
        }

        return results;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<List<ImageMatchCandidate>> SearchByNameAsync(
        string host,
        string source,
        string query,
        EnrichmentProductInput input,
        CancellationToken ct)
    {
        try
        {
            using var http = _httpFactory.CreateClient("EnrichmentNameSearch");
            var encoded    = HttpUtility.UrlEncode(query);
            var url        = $"{host}/cgi/search.pl?search_terms={encoded}&search_simple=1&action=process&json=1&fields=code,product_name,brands,image_front_url,image_url&page_size=2";

            var response = await http.GetFromJsonAsync<OffSearchResponse>(url, ct);
            if (response?.Products is null || response.Products.Count == 0)
                return [];

            return response.Products
                .Where(p => !string.IsNullOrWhiteSpace(p.ImageFrontUrl ?? p.ImageUrl))
                .Select(p => new ImageMatchCandidate(
                    Source:           source,
                    ImageUrl:         (p.ImageFrontUrl ?? p.ImageUrl)!,
                    CandidateName:    p.ProductName,
                    CandidateBrand:   p.Brands,
                    CandidateBarcode: p.Code,
                    SearchQuery:      query))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Busca por nome falhou em {Host} para '{Query}'", host, query);
            return [];
        }
    }

    private static string BuildSearchQuery(string productName)
    {
        // Remove caracteres especiais e mantém apenas palavras com 3+ chars
        var words = productName
            .ToLowerInvariant()
            .Split([' ', '-', '/', '\\', ',', '.', '(', ')'], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3)
            .Take(5)
            .ToArray();

        return string.Join(" ", words);
    }
}
