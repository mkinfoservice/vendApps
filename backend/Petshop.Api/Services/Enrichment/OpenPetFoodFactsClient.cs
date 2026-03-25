using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs da API Open Pet Food Facts ──────────────────────────────────────────

internal record OpenPetFoodFactsResponse(
    [property: JsonPropertyName("status")] int Status,
    [property: JsonPropertyName("product")] OpenPetFoodFactsProduct? Product);

internal record OpenPetFoodFactsProduct(
    [property: JsonPropertyName("code")]            string? Code,
    [property: JsonPropertyName("product_name")]    string? ProductName,
    [property: JsonPropertyName("brands")]          string? Brands,
    [property: JsonPropertyName("image_url")]       string? ImageUrl,
    [property: JsonPropertyName("image_front_url")] string? ImageFrontUrl);

// ── Cliente ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem via Open Pet Food Facts (gratuito, sem API key).
/// Cobertura específica para produtos pet (ração, petiscos, suplementos).
/// Funciona apenas para produtos com EAN/barcode (8–14 dígitos).
/// </summary>
public sealed class OpenPetFoodFactsClient : IProductImageMatcher
{
    private readonly HttpClient _http;
    private readonly ILogger<OpenPetFoodFactsClient> _logger;

    public OpenPetFoodFactsClient(HttpClient http, ILogger<OpenPetFoodFactsClient> logger)
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
            var response = await _http.GetFromJsonAsync<OpenPetFoodFactsResponse>(
                $"api/v0/product/{barcode}.json", ct);

            if (response?.Status != 1 || response.Product is null)
                return [];

            var imageUrl = response.Product.ImageFrontUrl ?? response.Product.ImageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl))
                return [];

            return [new ImageMatchCandidate(
                Source:           "OpenPetFoodFacts",
                ImageUrl:         imageUrl,
                CandidateName:    response.Product.ProductName,
                CandidateBrand:   response.Product.Brands,
                CandidateBarcode: response.Product.Code,
                SearchQuery:      barcode)];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenPetFoodFacts lookup falhou para barcode {Barcode}", input.Barcode);
            return [];
        }
    }
}
