using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs da API Open Food Facts ───────────────────────────────────────────────

internal record OpenFoodFactsResponse(
    [property: JsonPropertyName("status")] int Status,
    [property: JsonPropertyName("product")] OpenFoodFactsProduct? Product);

internal record OpenFoodFactsProduct(
    [property: JsonPropertyName("code")]              string? Code,
    [property: JsonPropertyName("product_name")]      string? ProductName,
    [property: JsonPropertyName("brands")]            string? Brands,
    [property: JsonPropertyName("image_url")]         string? ImageUrl,
    [property: JsonPropertyName("image_front_url")]   string? ImageFrontUrl);

// ── Cliente ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem de produto via Open Food Facts (gratuito, sem API key).
/// Funciona apenas para produtos com EAN/barcode (8–14 dígitos).
/// Portado e adaptado do pacote externo vendapps_enrichment_service.
/// </summary>
public sealed class OpenFoodFactsClient : IProductImageMatcher
{
    private readonly HttpClient _http;
    private readonly ILogger<OpenFoodFactsClient> _logger;

    public OpenFoodFactsClient(HttpClient http, ILogger<OpenFoodFactsClient> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Barcode))
            return [];

        var barcode = new string(input.Barcode.Where(char.IsDigit).ToArray());
        if (barcode.Length is < 8 or > 14)
            return [];

        try
        {
            var url      = $"https://world.openfoodfacts.org/api/v0/product/{barcode}.json";
            var response = await _http.GetFromJsonAsync<OpenFoodFactsResponse>(url, ct);

            if (response?.Status != 1 || response.Product is null)
                return [];

            var imageUrl = response.Product.ImageFrontUrl ?? response.Product.ImageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl))
                return [];

            return [new ImageMatchCandidate(
                Source:           "OpenFoodFacts",
                ImageUrl:         imageUrl,
                CandidateName:    response.Product.ProductName,
                CandidateBrand:   response.Product.Brands,
                CandidateBarcode: response.Product.Code,
                SearchQuery:      barcode)];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenFoodFacts lookup falhou para barcode {Barcode}", input.Barcode);
            return [];
        }
    }
}
