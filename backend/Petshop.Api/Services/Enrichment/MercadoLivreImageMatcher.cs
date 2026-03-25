using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs da API Mercado Livre ─────────────────────────────────────────────────

internal record MlSearchResponse(
    [property: JsonPropertyName("results")] List<MlSearchItem>? Results);

internal record MlSearchItem(
    [property: JsonPropertyName("id")]        string? Id,
    [property: JsonPropertyName("title")]     string? Title,
    [property: JsonPropertyName("thumbnail")] string? Thumbnail);

// ── Matcher ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem de produto via API pública do Mercado Livre (gratuita, sem API key).
/// Estratégia: primeiro busca por EAN/barcode (match exato), depois por nome.
/// Funciona muito bem para produtos pet brasileiros (ração, petiscos, acessórios).
/// </summary>
public sealed class MercadoLivreImageMatcher : IProductImageMatcher
{
    private readonly HttpClient _http;
    private readonly ILogger<MercadoLivreImageMatcher> _logger;

    public MercadoLivreImageMatcher(HttpClient http, ILogger<MercadoLivreImageMatcher> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        // Tenta por EAN primeiro (mais preciso), depois por nome
        var candidates = new List<ImageMatchCandidate>();

        var barcodeResult = await SearchAsync(input.Barcode, "barcode", input, ct);
        candidates.AddRange(barcodeResult);

        // Se não achou por barcode, busca por nome (limita a 3 tokens principais)
        if (candidates.Count == 0)
        {
            var nameQuery = BuildNameQuery(input.Name);
            if (!string.IsNullOrWhiteSpace(nameQuery))
            {
                var nameResult = await SearchAsync(nameQuery, "name", input, ct);
                candidates.AddRange(nameResult);
            }
        }

        return candidates;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<List<ImageMatchCandidate>> SearchAsync(
        string? query,
        string queryType,
        EnrichmentProductInput input,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        try
        {
            var encoded  = HttpUtility.UrlEncode(query);
            var url      = $"sites/MLB/search?q={encoded}&limit=3";
            var response = await _http.GetFromJsonAsync<MlSearchResponse>(url, ct);

            if (response?.Results is null || response.Results.Count == 0)
                return [];

            return response.Results
                .Where(r => !string.IsNullOrWhiteSpace(r.Thumbnail))
                .Select(r => new ImageMatchCandidate(
                    Source:           "MercadoLivre",
                    ImageUrl:         UpscaleThumbnail(r.Thumbnail!),
                    CandidateName:    r.Title,
                    CandidateBrand:   null,
                    CandidateBarcode: queryType == "barcode" ? query : null,
                    SearchQuery:      query))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "MercadoLivre search falhou para query '{Query}'", query);
            return [];
        }
    }

    /// <summary>
    /// Converte thumbnail ML (-I. 170px) para versão de maior qualidade (-F. 600px).
    /// </summary>
    private static string UpscaleThumbnail(string url) =>
        url.Replace("-I.", "-F.").Replace("-O.", "-F.");

    /// <summary>
    /// Extrai os tokens mais relevantes do nome para busca (marca + produto + peso).
    /// Ex: "RAÇÃO ROYAL CANIN ADULTO 15KG" → "ração royal canin 15kg"
    /// </summary>
    private static string BuildNameQuery(string name)
    {
        var tokens = name
            .ToLowerInvariant()
            .Split([' ', '-', '/', '(', ')'], StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 2)
            .Take(5)
            .ToArray();

        return string.Join(" ", tokens);
    }
}
