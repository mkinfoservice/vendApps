using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs da API Cosmos (Bluesoft) ─────────────────────────────────────────────

internal record CosmosProduct(
    [property: JsonPropertyName("gtin")]        string?       Gtin,
    [property: JsonPropertyName("description")] string?       Description,
    [property: JsonPropertyName("thumbnail")]   string?       Thumbnail,
    [property: JsonPropertyName("brand")]       CosmosBrand?  Brand);

internal record CosmosBrand(
    [property: JsonPropertyName("name")] string? Name);

// ── Matcher ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem de produto via Cosmos (Bluesoft) — base brasileira de GTINs/EANs.
/// Requer COSMOS_TOKEN nas variáveis de ambiente (cadastro gratuito em cosmos.bluesoft.com.br).
/// Funciona apenas para produtos com barcode EAN/GTIN cadastrado.
/// </summary>
public sealed class CosmosImageMatcher : IProductImageMatcher
{
    private readonly HttpClient _http;
    private readonly ILogger<CosmosImageMatcher> _logger;

    public CosmosImageMatcher(HttpClient http, ILogger<CosmosImageMatcher> logger)
    {
        _http   = http;
        _logger = logger;
    }

    /// <summary>Usado pelo job de enriquecimento em lote.</summary>
    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Barcode)) return [];

        var barcode = new string(input.Barcode.Where(char.IsDigit).ToArray());
        if (barcode.Length < 8) return [];

        try
        {
            var product = await FetchAsync(barcode, ct);
            if (product is null) return [];

            return [new ImageMatchCandidate(
                Source:           "Cosmos",
                ImageUrl:         product.Thumbnail!,
                CandidateName:    product.Description,
                CandidateBrand:   product.Brand?.Name,
                CandidateBarcode: barcode,
                SearchQuery:      barcode)];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cosmos lookup falhou para barcode {Barcode}", input.Barcode);
            return [];
        }
    }

    /// <summary>Usado pelo picker manual do admin (busca por barcode).</summary>
    public async Task<List<ImageSearchResult>> SearchForPickerAsync(string barcode, CancellationToken ct)
    {
        var clean = new string(barcode.Where(char.IsDigit).ToArray());
        if (clean.Length < 8) return [];

        try
        {
            var product = await FetchAsync(clean, ct);
            if (product is null) return [];

            return [new ImageSearchResult(
                ItemId:   clean,
                Title:    product.Description ?? clean,
                Pictures: [product.Thumbnail!])];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cosmos picker falhou para barcode {Barcode}", barcode);
            return [];
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<CosmosProduct?> FetchAsync(string barcode, CancellationToken ct)
    {
        var response = await _http.GetAsync(
            $"https://cosmos.bluesoft.com.br/products/{barcode}.json", ct);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();

        var product = await response.Content.ReadFromJsonAsync<CosmosProduct>(ct);
        if (string.IsNullOrWhiteSpace(product?.Thumbnail))
            return null;

        return product;
    }
}

/// <summary>Resultado do picker: um item com sua(s) imagem(ns).</summary>
public record ImageSearchResult(string ItemId, string Title, List<string> Pictures);
