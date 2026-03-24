using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;

namespace PrintAgent.Services;

/// <summary>
/// Autentica o agente via /auth/login e extrai o companyId do JWT.
/// </summary>
public class PrintAuthService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<PrintAuthService> _logger;

    public PrintAuthService(HttpClient http, IConfiguration config, ILogger<PrintAuthService> logger)
    {
        _http   = http;
        _config = config;
        _logger = logger;
    }

    public async Task<(string Token, string CompanyId)?> LoginAsync(CancellationToken ct)
    {
        var username = _config["PrintAgent:Username"];
        var password = _config["PrintAgent:Password"];

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogError("PrintAgent:Username ou PrintAgent:Password não configurados.");
            return null;
        }

        try
        {
            var res = await _http.PostAsJsonAsync("/auth/login",
                new { Username = username, Password = password }, ct);

            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("Falha na autenticação: {Status}", res.StatusCode);
                return null;
            }

            var body = await res.Content.ReadFromJsonAsync<LoginResponse>(ct);
            if (body?.Token is null)
            {
                _logger.LogError("Resposta de login sem token.");
                return null;
            }

            // Extrai companyId do JWT sem validar assinatura (só leitura de claims)
            var handler   = new JwtSecurityTokenHandler();
            var jwt       = handler.ReadJwtToken(body.Token);
            var companyId = jwt.Claims.FirstOrDefault(c => c.Type == "companyId")?.Value ?? "";

            _logger.LogInformation("Autenticado. CompanyId={CompanyId}", companyId);
            return (body.Token, companyId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao autenticar.");
            return null;
        }
    }

    private record LoginResponse(string Token);
}
