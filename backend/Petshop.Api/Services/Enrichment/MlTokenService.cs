using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Obtém e armazena em cache um access token do Mercado Livre via Client Credentials.
/// Requer ML_APP_ID e ML_CLIENT_SECRET nas variáveis de ambiente.
/// O token dura 6h — renovado automaticamente ao expirar.
/// </summary>
public sealed class MlTokenService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<MlTokenService> _logger;
    private readonly string? _appId;
    private readonly string? _clientSecret;

    private const string CacheKey = "ml_access_token";

    public MlTokenService(
        IHttpClientFactory httpFactory,
        IMemoryCache cache,
        IConfiguration config,
        ILogger<MlTokenService> logger)
    {
        _httpFactory   = httpFactory;
        _cache         = cache;
        _logger        = logger;
        _appId         = config["ML_APP_ID"];
        _clientSecret  = config["ML_CLIENT_SECRET"];
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_appId) && !string.IsNullOrWhiteSpace(_clientSecret);

    /// <summary>
    /// Retorna um access token válido, obtendo/renovando do cache conforme necessário.
    /// Retorna null se as credenciais não estiverem configuradas.
    /// </summary>
    public async Task<string?> GetTokenAsync(CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        if (_cache.TryGetValue(CacheKey, out string? cached))
            return cached;

        return await FetchTokenAsync(ct);
    }

    private async Task<string?> FetchTokenAsync(CancellationToken ct)
    {
        try
        {
            using var http = _httpFactory.CreateClient();
            var body = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"]    = "client_credentials",
                ["client_id"]     = _appId!,
                ["client_secret"] = _clientSecret!,
            });

            var res = await http.PostAsync("https://api.mercadolibre.com/oauth/token", body, ct);
            res.EnsureSuccessStatusCode();

            var data = await res.Content.ReadFromJsonAsync<MlTokenResponse>(cancellationToken: ct);
            if (data?.AccessToken is null) return null;

            // Armazena com 5min de margem antes do vencimento (token dura 6h = 21600s)
            var expiry = TimeSpan.FromSeconds(Math.Max(60, (data.ExpiresIn ?? 21600) - 300));
            _cache.Set(CacheKey, data.AccessToken, expiry);

            _logger.LogInformation("ML access token obtido com sucesso (expira em {Minutes}min)", expiry.TotalMinutes);
            return data.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao obter ML access token");
            return null;
        }
    }
}

internal record MlTokenResponse(
    [property: JsonPropertyName("access_token")] string? AccessToken,
    [property: JsonPropertyName("expires_in")]   int?    ExpiresIn);
