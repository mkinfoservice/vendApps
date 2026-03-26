using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace Petshop.Api.Services.Enrichment;

// ── DTOs da Google Custom Search API ─────────────────────────────────────────

internal record GoogleSearchResponse(
    [property: JsonPropertyName("items")] List<GoogleSearchItem>? Items);

internal record GoogleSearchItem(
    [property: JsonPropertyName("title")] string? Title,
    [property: JsonPropertyName("link")]  string? Link);

// ── Matcher ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagens de produto via Google Custom Search API (searchType=image).
/// Requer GOOGLE_API_KEY e GOOGLE_CSE_ID nas variáveis de ambiente.
/// Tier gratuito: 100 consultas/dia.
/// </summary>
public sealed class GoogleImageSearchMatcher
{
    private readonly HttpClient _http;
    private readonly ILogger<GoogleImageSearchMatcher> _logger;
    private readonly string? _apiKey;
    private readonly string? _cseId;

    public GoogleImageSearchMatcher(
        HttpClient http,
        IConfiguration config,
        ILogger<GoogleImageSearchMatcher> logger)
    {
        _http   = http;
        _logger = logger;
        _apiKey = config["GOOGLE_API_KEY"]?.Trim();
        _cseId  = config["GOOGLE_CSE_ID"]?.Trim();
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_apiKey) && !string.IsNullOrWhiteSpace(_cseId);

    /// <summary>
    /// Busca imagens para o picker manual do admin.
    /// Retorna até 10 imagens do Google Images para a query informada.
    /// </summary>
    public async Task<List<ImageSearchResult>> SearchForPickerAsync(string query, CancellationToken ct)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(query)) return [];

        try
        {
            var encoded = HttpUtility.UrlEncode(query);
            var url     = $"https://www.googleapis.com/customsearch/v1" +
                          $"?key={_apiKey}&cx={_cseId}&q={encoded}&searchType=image&num=10";

            var response = await _http.GetFromJsonAsync<GoogleSearchResponse>(url, ct);

            if (response?.Items is null || response.Items.Count == 0)
                return [];

            return response.Items
                .Where(i => !string.IsNullOrWhiteSpace(i.Link))
                .Select(i => new ImageSearchResult(
                    ItemId:   Guid.NewGuid().ToString(),
                    Title:    i.Title ?? query,
                    Pictures: [i.Link!]))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google image search falhou para '{Query}'", query);
            return [];
        }
    }
}

/// <summary>Resultado do picker: um item com sua(s) imagem(ns).</summary>
public record ImageSearchResult(string ItemId, string Title, List<string> Pictures);
