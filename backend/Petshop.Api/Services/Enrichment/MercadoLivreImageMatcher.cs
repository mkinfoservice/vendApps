using System.Net.Http.Headers;
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

internal record MlItemDetail(
    [property: JsonPropertyName("id")]       string?            Id,
    [property: JsonPropertyName("title")]    string?            Title,
    [property: JsonPropertyName("pictures")] List<MlPicture>?   Pictures);

// Batch endpoint GET /items?ids=... retorna cada item embrulhado em {code, body}
internal record MlItemBatchEntry(
    [property: JsonPropertyName("code")] int Code,
    [property: JsonPropertyName("body")] MlItemDetail? Body);

internal record MlPicture(
    [property: JsonPropertyName("id")]          string? Id,
    [property: JsonPropertyName("secure_url")]  string? SecureUrl,
    [property: JsonPropertyName("url")]         string? Url,
    [property: JsonPropertyName("max_size")]    string? MaxSize)
{
    public string BestUrl => !string.IsNullOrEmpty(SecureUrl) ? SecureUrl
                           : !string.IsNullOrEmpty(Url)       ? Url
                           : string.Empty;
}

// ── Matcher ───────────────────────────────────────────────────────────────────

/// <summary>
/// Busca imagem de produto via API do Mercado Livre.
/// Usa OAuth client credentials (ML_APP_ID + ML_CLIENT_SECRET) quando disponível,
/// evitando bloqueio de IP de servidores cloud.
/// </summary>
public sealed class MercadoLivreImageMatcher : IProductImageMatcher
{
    private const string BaseUrl = "https://api.mercadolibre.com";

    private readonly IHttpClientFactory _httpFactory;
    private readonly MlTokenService _tokenService;
    private readonly ILogger<MercadoLivreImageMatcher> _logger;

    public MercadoLivreImageMatcher(
        IHttpClientFactory httpFactory,
        MlTokenService tokenService,
        ILogger<MercadoLivreImageMatcher> logger)
    {
        _httpFactory  = httpFactory;
        _tokenService = tokenService;
        _logger       = logger;
    }

    /// <summary>Cria HttpClient com Authorization header se token disponível.</summary>
    private async Task<HttpClient> CreateClientAsync(CancellationToken ct)
    {
        var http  = _httpFactory.CreateClient("MercadoLivre");
        var token = await _tokenService.GetTokenAsync(ct);
        if (token is not null)
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return http;
    }

    public async Task<IReadOnlyList<ImageMatchCandidate>> FindCandidatesAsync(
        EnrichmentProductInput input,
        CancellationToken ct = default)
    {
        var candidates = new List<ImageMatchCandidate>();

        var barcodeResult = await SearchAsync(input.Barcode, "barcode", input, ct);
        candidates.AddRange(barcodeResult);

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
            using var http   = await CreateClientAsync(ct);
            var encoded      = HttpUtility.UrlEncode(query);
            var response     = await http.GetFromJsonAsync<MlSearchResponse>(
                                   $"{BaseUrl}/sites/MLB/search?q={encoded}&limit=5", ct);

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
            _logger.LogWarning(ex, "MercadoLivre search falhou para query '{Query}'", query);
            return [];
        }
    }

    /// <summary>
    /// Busca imagens para o picker manual do admin.
    /// Retorna múltiplas fotos por item do ML (via GET /items/{id}).
    /// </summary>
    public async Task<List<MlImageResult>> SearchForPickerAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        using var http = await CreateClientAsync(ct);
        var encoded    = HttpUtility.UrlEncode(query);
        var search     = await http.GetFromJsonAsync<MlSearchResponse>(
                             $"{BaseUrl}/sites/MLB/search?q={encoded}&limit=5", ct);

        if (search?.Results is null || search.Results.Count == 0)
            return [];

        // Batch: [{code, body},...}]
        var ids     = string.Join(",", search.Results.Select(r => r.Id));
        var entries = await http.GetFromJsonAsync<List<MlItemBatchEntry>>(
                          $"{BaseUrl}/items?ids={ids}", ct);

        var results = new List<MlImageResult>();

        if (entries?.Count > 0)
        {
            foreach (var entry in entries.Where(e => e.Code == 200 && e.Body?.Pictures != null))
            {
                var item     = entry.Body!;
                var pictures = item.Pictures!
                    .Where(p => !string.IsNullOrEmpty(p.BestUrl))
                    .Select(p => p.BestUrl)
                    .ToList();
                if (pictures.Count > 0)
                    results.Add(new MlImageResult(item.Id!, item.Title ?? "", pictures));
            }
        }

        // Fallback para thumbnails se batch não retornou fotos
        if (results.Count == 0)
        {
            foreach (var r in search.Results.Where(r => !string.IsNullOrWhiteSpace(r.Thumbnail)))
                results.Add(new MlImageResult(r.Id!, r.Title ?? "", [UpscaleThumbnail(r.Thumbnail!)]));
        }

        return results;
    }

    private static string UpscaleThumbnail(string url) =>
        url.Replace("-I.", "-F.").Replace("-O.", "-F.");

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

/// <summary>Resultado do picker manual: um item do ML com todas as suas fotos.</summary>
public record MlImageResult(string ItemId, string Title, List<string> Pictures);
