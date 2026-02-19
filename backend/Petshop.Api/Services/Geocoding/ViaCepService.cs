using System.Text.Json.Serialization;

namespace Petshop.Api.Services.Geocoding;

public class ViaCepResult
{
    [JsonPropertyName("cep")]
    public string? Cep { get; set; }

    [JsonPropertyName("logradouro")]
    public string? Logradouro { get; set; }

    [JsonPropertyName("complemento")]
    public string? Complemento { get; set; }

    [JsonPropertyName("bairro")]
    public string? Bairro { get; set; }

    [JsonPropertyName("localidade")]
    public string? Localidade { get; set; }

    [JsonPropertyName("uf")]
    public string? Uf { get; set; }

    [JsonPropertyName("erro")]
    public bool Erro { get; set; }
}

/// <summary>
/// Consulta ViaCEP (gratuito, 100% cobertura BR) para normalizar
/// endereço a partir do CEP — retorna logradouro, bairro, cidade, UF.
/// </summary>
public class ViaCepService
{
    private readonly HttpClient _http;
    private readonly ILogger<ViaCepService> _logger;

    public ViaCepService(HttpClient http, ILogger<ViaCepService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<ViaCepResult?> GetAddressAsync(string? cep, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cep)) return null;

        var cleanCep = cep.Replace("-", "").Replace(".", "").Trim();

        if (cleanCep.Length != 8 || !cleanCep.All(char.IsDigit))
        {
            _logger.LogWarning("📮 ViaCEP: CEP inválido '{Cep}' (esperado 8 dígitos)", cep);
            return null;
        }

        try
        {
            var url = $"https://viacep.com.br/ws/{cleanCep}/json/";

            _logger.LogDebug("📮 ViaCEP: consultando CEP {Cep}...", cleanCep);

            using var resp = await _http.GetAsync(url, ct);

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("📮 ViaCEP: status {StatusCode} para CEP {Cep}", resp.StatusCode, cleanCep);
                return null;
            }

            var result = await resp.Content.ReadFromJsonAsync<ViaCepResult>(ct);

            if (result == null || result.Erro)
            {
                _logger.LogWarning("📮 ViaCEP: CEP {Cep} não encontrado (erro=true)", cleanCep);
                return null;
            }

            _logger.LogInformation(
                "📮 ViaCEP: CEP {Cep} → {Logradouro}, {Bairro}, {Localidade}/{Uf}",
                cleanCep, result.Logradouro, result.Bairro, result.Localidade, result.Uf);

            return result;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("📮 ViaCEP: timeout para CEP {Cep}", cleanCep);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "📮 ViaCEP: erro ao consultar CEP {Cep}", cleanCep);
            return null;
        }
    }
}
