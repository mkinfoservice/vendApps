using System.Text;
using System.Text.Json;

namespace Petshop.Api.Services;

/// <summary>
/// Serviço para chamar ORS Matrix API e obter tempos/distâncias reais de trajeto
/// </summary>
public class OrsMatrixService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<OrsMatrixService> _logger;

    public OrsMatrixService(HttpClient http, IConfiguration config, ILogger<OrsMatrixService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
        // Timeout configurado no Program.cs via AddHttpClient
    }

    /// <summary>
    /// Calcula matriz de tempos de trajeto entre múltiplos pontos.
    /// Retorna matriz[origem][destino] = segundos de viagem.
    /// </summary>
    public async Task<double[][]?> GetTravelTimeMatrixAsync(
        List<(double lat, double lon)> coordinates,
        CancellationToken ct = default)
    {
        if (coordinates == null || coordinates.Count < 2)
        {
            _logger.LogWarning("🚗 ORS Matrix: precisa de pelo menos 2 coordenadas");
            return null;
        }

        var apiKey = _config["Geocoding:Ors:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("🚗 ORS Matrix: API Key não configurada, fallback para Haversine");
            return null;
        }

        try
        {
            _logger.LogInformation("🚗 ORS Matrix: calculando tempos de trajeto para {Count} pontos...", coordinates.Count);

            // ORS Matrix API espera [[lon, lat], [lon, lat], ...]
            var locations = coordinates.Select(c => new[] { c.lon, c.lat }).ToArray();

            var requestBody = new
            {
                locations = locations,
                metrics = new[] { "duration" }, // Queremos tempo de viagem
                units = "m" // Metros e segundos
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var url = $"https://api.openrouteservice.org/v2/matrix/driving-car";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", apiKey);
            request.Content = content;

            var response = await _http.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("🚗 ORS Matrix: HTTP {Status} - {Error}", response.StatusCode, errorBody);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseJson);

            if (!doc.RootElement.TryGetProperty("durations", out var durations))
            {
                _logger.LogWarning("🚗 ORS Matrix: resposta sem 'durations'");
                return null;
            }

            // Converte JsonElement array para double[][]
            var matrix = new List<double[]>();
            foreach (var row in durations.EnumerateArray())
            {
                var rowList = new List<double>();
                foreach (var cell in row.EnumerateArray())
                {
                    rowList.Add(cell.GetDouble());
                }
                matrix.Add(rowList.ToArray());
            }

            _logger.LogInformation("✅ ORS Matrix: matriz {Size}x{Size} calculada com sucesso", matrix.Count, matrix[0].Length);

            // Log de tempos para debug (só primeiros 3 para não poluir)
            for (int i = 0; i < Math.Min(3, matrix.Count); i++)
            {
                for (int j = 0; j < Math.Min(3, matrix[i].Length); j++)
                {
                    if (i != j) // Ignora diagonal (origem = destino)
                    {
                        _logger.LogDebug("🚗 Tempo [{From}→{To}]: {Minutes:F1} min", i, j, matrix[i][j] / 60.0);
                    }
                }
            }

            return matrix.ToArray();
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("🚗 ORS Matrix: timeout após 15s");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "🚗 ORS Matrix: erro ao calcular matriz");
            return null;
        }
    }

    /// <summary>
    /// Versão simplificada: retorna apenas o tempo de trajeto entre dois pontos.
    /// </summary>
    public async Task<double?> GetTravelTimeAsync(
        (double lat, double lon) origin,
        (double lat, double lon) destination,
        CancellationToken ct = default)
    {
        var matrix = await GetTravelTimeMatrixAsync(new List<(double, double)> { origin, destination }, ct);

        if (matrix == null || matrix.Length < 2 || matrix[0].Length < 2)
            return null;

        return matrix[0][1]; // Tempo de [0] para [1]
    }
}
