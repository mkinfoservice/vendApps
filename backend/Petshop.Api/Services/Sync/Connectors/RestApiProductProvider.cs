using System.Net.Http.Headers;
using System.Text.Json;

namespace Petshop.Api.Services.Sync.Connectors;

/// <summary>
/// Conector REST ERP genérico. ConnectionConfigEncrypted deve conter:
/// { "Url": "https://erp.exemplo.com/api/products", "ApiKey": "xxx", "PageParam": "page", "SizeParam": "size" }
/// Espera resposta JSON com array de objetos que mapeiem para ExternalProductDto.
/// </summary>
public class RestApiProductProvider : IProductProvider
{
    private readonly RestApiConfig _config;
    private readonly IHttpClientFactory _httpClientFactory;

    public string ProviderName => "REST ERP";

    public RestApiProductProvider(string connectionConfigJson, IHttpClientFactory httpClientFactory)
    {
        _config = JsonSerializer.Deserialize<RestApiConfig>(connectionConfigJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Configuração REST inválida.");
        _httpClientFactory = httpClientFactory;
    }

    public Task<ProviderCapabilities> GetCapabilitiesAsync(CancellationToken ct) =>
        Task.FromResult(new ProviderCapabilities
        {
            SupportsDelta = !string.IsNullOrEmpty(_config.UpdatedSinceParam),
            SupportsHashCheck = false,
            SupportsImages = false
        });

    public async Task<IReadOnlyList<ExternalProductDto>> FetchProductsAsync(ExternalProductQuery query, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);

        if (!string.IsNullOrEmpty(_config.ApiKey))
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _config.ApiKey);

        var pageParam = _config.PageParam ?? "page";
        var sizeParam = _config.SizeParam ?? "size";
        var url = $"{_config.Url}?{pageParam}={query.Page}&{sizeParam}={query.BatchSize}";

        if (query.SyncType == Entities.Sync.SyncType.Delta && query.UpdatedSince.HasValue
            && !string.IsNullOrEmpty(_config.UpdatedSinceParam))
        {
            url += $"&{_config.UpdatedSinceParam}={query.UpdatedSince.Value:O}";
        }

        var response = await client.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);

        // Tenta desserializar como array diretamente, ou como objeto com propriedade "data"/"items"
        try
        {
            var items = JsonSerializer.Deserialize<List<ExternalProductDto>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return items ?? new List<ExternalProductDto>();
        }
        catch
        {
            // Tenta extrair de envelope { "data": [...] } ou { "items": [...] }
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            foreach (var key in new[] { "data", "items", "products", "result", "results" })
            {
                if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    var items2 = JsonSerializer.Deserialize<List<ExternalProductDto>>(arr.GetRawText(),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    return items2 ?? new List<ExternalProductDto>();
                }
            }
        }

        return new List<ExternalProductDto>();
    }

    public async Task<(bool Success, string Message, int SampleCount)> TestConnectionAsync(CancellationToken ct)
    {
        try
        {
            var sample = await FetchProductsAsync(new ExternalProductQuery { Page = 1, BatchSize = 3 }, ct);
            return (true, $"Conexão REST OK. {sample.Count} registro(s) de amostra.", sample.Count);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, 0);
        }
    }

    private class RestApiConfig
    {
        public string Url { get; set; } = default!;
        public string? ApiKey { get; set; }
        public string? PageParam { get; set; }
        public string? SizeParam { get; set; }
        public string? UpdatedSinceParam { get; set; }
    }
}
