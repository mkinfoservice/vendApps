using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Petshop.Api.Entities.Marketplace;

namespace Petshop.Api.Services.Marketplace.IFood;

/// <summary>
/// Gerencia tokens OAuth2 do iFood com cache automático.
/// O token expira em 6 horas — esta classe renova antes do vencimento.
/// </summary>
public class iFoodAuthService
{
    private readonly IHttpClientFactory _http;
    private readonly ILogger<iFoodAuthService> _logger;

    // Cache por integrationId → (token, expiresAt)
    private readonly Dictionary<Guid, (string Token, DateTime ExpiresAt)> _cache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);

    private const string TokenUrl = "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token";

    public iFoodAuthService(IHttpClientFactory http, ILogger<iFoodAuthService> logger)
    {
        _http = http;
        _logger = logger;
    }

    /// <summary>
    /// Retorna um token válido para a integração. Renova automaticamente se expirado ou próximo de expirar.
    /// </summary>
    public async Task<string> GetTokenAsync(MarketplaceIntegration integration, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue(integration.Id, out var cached) &&
                cached.ExpiresAt > DateTime.UtcNow.AddMinutes(5))
            {
                return cached.Token;
            }

            var token = await FetchTokenAsync(integration, ct);
            // iFood tokens duram 6h; guardamos com margem de 10min
            _cache[integration.Id] = (token, DateTime.UtcNow.AddHours(5).AddMinutes(50));
            return token;
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>Invalida o cache para forçar renovação (ex: após 401).</summary>
    public void Invalidate(Guid integrationId) => _cache.Remove(integrationId);

    private async Task<string> FetchTokenAsync(MarketplaceIntegration integration, CancellationToken ct)
    {
        using var client = _http.CreateClient("ifood");

        var form = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grantType", "client_credentials"),
            new KeyValuePair<string, string>("clientId", integration.ClientId),
            new KeyValuePair<string, string>("clientSecret", integration.ClientSecretEncrypted),
        });

        var response = await client.PostAsync(TokenUrl, form, ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("[iFood] Falha ao obter token. Status={Status} Body={Body}",
                response.StatusCode, body);
            throw new InvalidOperationException($"iFood auth falhou: {response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<iFoodTokenResponse>(cancellationToken: ct);
        return result?.AccessToken
            ?? throw new InvalidOperationException("iFood retornou token vazio.");
    }

    private sealed class iFoodTokenResponse
    {
        [JsonPropertyName("accessToken")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("tokenType")]
        public string? TokenType { get; set; }

        [JsonPropertyName("expiresIn")]
        public int ExpiresIn { get; set; }
    }
}
