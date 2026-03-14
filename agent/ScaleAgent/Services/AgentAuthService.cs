using System.Net.Http.Json;

namespace ScaleAgent.Services;

/// <summary>
/// Autentica o agente na API e retorna o JWT para uso no SignalR.
/// </summary>
public class AgentAuthService
{
    private readonly HttpClient    _http;
    private readonly IConfiguration _config;
    private readonly ILogger<AgentAuthService> _logger;

    public AgentAuthService(HttpClient http, IConfiguration config, ILogger<AgentAuthService> logger)
    {
        _http   = http;
        _config = config;
        _logger = logger;
    }

    public async Task<string?> GetTokenAsync(CancellationToken ct)
    {
        var agentKey = _config["ScaleAgent:AgentKey"];
        if (string.IsNullOrWhiteSpace(agentKey))
        {
            _logger.LogError("ScaleAgent:AgentKey não configurada.");
            return null;
        }

        var authPath = _config["ScaleAgent:AuthPath"] ?? "/scale/agent/auth";

        try
        {
            var response = await _http.PostAsJsonAsync(authPath, new { AgentKey = agentKey }, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Falha na autenticação: {Status}", response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<AuthResponse>(ct);
            return result?.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao autenticar com a API.");
            return null;
        }
    }

    private record AuthResponse(string AccessToken, Guid AgentId, Guid CompanyId);
}
