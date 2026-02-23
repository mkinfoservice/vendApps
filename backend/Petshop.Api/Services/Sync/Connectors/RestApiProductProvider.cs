using System.Net.Http.Headers;
using System.Text.Json;

namespace Petshop.Api.Services.Sync.Connectors;

/// <summary>
/// Conector REST ERP genérico. ConnectionConfigEncrypted deve conter:
/// {
///   "Url": "https://erp.exemplo.com/api/products",
///   "ApiKey": "xxx",
///   "PageParam": "page",
///   "SizeParam": "size",
///   "FieldMap": {
///     "ExternalId": "id",
///     "Name": "title",
///     "PriceCents": "price",
///     "PriceUnit": "decimal",
///     "CategoryName": "category",
///     "ImageUrl": "image",
///     "Description": "description"
///   }
/// }
/// Se FieldMap for omitido, espera campos com os mesmos nomes do ExternalProductDto.
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
        var rawElements = ExtractArray(json);

        if (_config.FieldMap != null)
            return rawElements.Select(el => ApplyFieldMap(el, _config.FieldMap)).ToList();

        // Sem FieldMap: deserializa diretamente para ExternalProductDto
        try
        {
            var items = JsonSerializer.Deserialize<List<ExternalProductDto>>(
                JsonSerializer.Serialize(rawElements),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return items ?? new List<ExternalProductDto>();
        }
        catch
        {
            return new List<ExternalProductDto>();
        }
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Extrai o array de elementos do JSON, seja como array direto ou dentro de
    /// um envelope com chave "data", "items", "products", etc.
    /// Os elementos são clonados para que possam ser usados após o JsonDocument ser descartado.
    /// </summary>
    private static List<JsonElement> ExtractArray(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.ValueKind == JsonValueKind.Array)
            return root.EnumerateArray().Select(e => e.Clone()).ToList();

        foreach (var key in new[] { "data", "items", "products", "result", "results" })
        {
            if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
                return arr.EnumerateArray().Select(e => e.Clone()).ToList();
        }

        return new List<JsonElement>();
    }

    /// <summary>
    /// Mapeia um JsonElement para ExternalProductDto usando o FieldMap configurado.
    /// </summary>
    private static ExternalProductDto ApplyFieldMap(JsonElement el, RestFieldMap map)
    {
        string? GetStr(string? fieldName)
        {
            if (string.IsNullOrWhiteSpace(fieldName)) return null;
            if (el.TryGetProperty(fieldName, out var v))
                return v.ValueKind switch
                {
                    JsonValueKind.String => v.GetString(),
                    JsonValueKind.Number => v.GetDecimal().ToString(),
                    JsonValueKind.True   => "true",
                    JsonValueKind.False  => "false",
                    _                   => null
                };
            return null;
        }

        int GetPriceCents(string? fieldName, string? unit)
        {
            if (string.IsNullOrWhiteSpace(fieldName)) return 0;
            if (!el.TryGetProperty(fieldName, out var v)) return 0;
            if (v.ValueKind != JsonValueKind.Number) return 0;
            return (unit ?? "cents").Equals("decimal", StringComparison.OrdinalIgnoreCase)
                ? (int)Math.Round(v.GetDecimal() * 100)
                : (v.TryGetInt32(out var i) ? i : (int)Math.Round(v.GetDecimal()));
        }

        decimal GetDecimalVal(string? fieldName)
        {
            if (string.IsNullOrWhiteSpace(fieldName)) return 0;
            if (!el.TryGetProperty(fieldName, out var v)) return 0;
            return v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : 0;
        }

        return new ExternalProductDto
        {
            ExternalId    = GetStr(map.ExternalId),
            Name          = GetStr(map.Name) ?? "",
            PriceCents    = GetPriceCents(map.PriceCents, map.PriceUnit),
            CostCents     = GetPriceCents(map.CostCents, map.PriceUnit),
            CategoryName  = GetStr(map.CategoryName),
            ImageUrl      = GetStr(map.ImageUrl),
            Description   = GetStr(map.Description),
            StockQty      = GetDecimalVal(map.StockQty),
            Barcode       = GetStr(map.Barcode),
            InternalCode  = GetStr(map.InternalCode),
            IsActive      = true,
            Unit          = "UN"
        };
    }

    // ── Config models ─────────────────────────────────────────────────────────

    private class RestApiConfig
    {
        public string Url { get; set; } = default!;
        public string? ApiKey { get; set; }
        public string? PageParam { get; set; }
        public string? SizeParam { get; set; }
        public string? UpdatedSinceParam { get; set; }
        public RestFieldMap? FieldMap { get; set; }
    }

    private class RestFieldMap
    {
        /// <summary>Nome do campo na origem que representa o ID único do produto.</summary>
        public string? ExternalId { get; set; }
        /// <summary>Nome do campo na origem que representa o nome do produto.</summary>
        public string? Name { get; set; }
        /// <summary>Nome do campo na origem que representa o preço.</summary>
        public string? PriceCents { get; set; }
        /// <summary>"decimal" se o preço vier como float (ex: 109.95) — será multiplicado por 100. "cents" (padrão) se já vier em centavos.</summary>
        public string? PriceUnit { get; set; }
        /// <summary>Nome do campo de custo (opcional).</summary>
        public string? CostCents { get; set; }
        /// <summary>Nome do campo de categoria.</summary>
        public string? CategoryName { get; set; }
        /// <summary>Nome do campo de URL da imagem.</summary>
        public string? ImageUrl { get; set; }
        /// <summary>Nome do campo de descrição.</summary>
        public string? Description { get; set; }
        /// <summary>Nome do campo de estoque.</summary>
        public string? StockQty { get; set; }
        /// <summary>Nome do campo de código de barras.</summary>
        public string? Barcode { get; set; }
        /// <summary>Nome do campo de código interno.</summary>
        public string? InternalCode { get; set; }
    }
}
