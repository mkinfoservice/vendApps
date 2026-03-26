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
            var url      = $"sites/MLB/search?q={encoded}&limit=5";
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
    /// Busca imagens para o picker manual do admin.
    /// Retorna múltiplas fotos por item do ML (via GET /items/{id}).
    /// </summary>
    public async Task<List<MlImageResult>> SearchForPickerAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        try
        {
            var encoded  = HttpUtility.UrlEncode(query);
            var search   = await _http.GetFromJsonAsync<MlSearchResponse>(
                               $"sites/MLB/search?q={encoded}&limit=5", ct);

            if (search?.Results is null || search.Results.Count == 0)
                return [];

            // Busca detalhes de todos os itens de uma vez (batch)
            // Resposta do ML: [{"code": 200, "body": {item}}, ...]
            var ids     = string.Join(",", search.Results.Select(r => r.Id));
            var entries = await _http.GetFromJsonAsync<List<MlItemBatchEntry>>(
                              $"items?ids={ids}", ct);

            var results = new List<MlImageResult>();

            // Fallback: se batch falhou, usa thumbnails upscalados da busca
            if (entries is null || entries.Count == 0)
            {
                foreach (var r in search.Results.Where(r => !string.IsNullOrWhiteSpace(r.Thumbnail)))
                    results.Add(new MlImageResult(r.Id!, r.Title ?? "", [UpscaleThumbnail(r.Thumbnail!)]));
                return results;
            }

            foreach (var entry in entries.Where(e => e.Code == 200 && e.Body?.Pictures != null))
            {
                var item     = entry.Body!;
                var pictures = item.Pictures!
                    .Where(p => !string.IsNullOrEmpty(p.BestUrl))
                    .Select(p => p.BestUrl)
                    .ToList();
                if (pictures.Count == 0) continue;
                results.Add(new MlImageResult(item.Id!, item.Title ?? "", pictures));
            }

            // Se mesmo assim não encontrou fotos, usa thumbnails como fallback
            if (results.Count == 0)
            {
                foreach (var r in search.Results.Where(r => !string.IsNullOrWhiteSpace(r.Thumbnail)))
                    results.Add(new MlImageResult(r.Id!, r.Title ?? "", [UpscaleThumbnail(r.Thumbnail!)]));
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "MercadoLivre picker search falhou para '{Query}'", query);
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

/// <summary>Resultado do picker manual: um item do ML com todas as suas fotos.</summary>
public record MlImageResult(string ItemId, string Title, List<string> Pictures);
