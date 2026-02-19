namespace Petshop.Api.Services.Geocoding;

/// <summary>
/// Serviço de geocoding com fallback automático:
/// 1. Tenta ORS primeiro (mais preciso para o Rio de Janeiro)
/// 2. Se falhar, tenta Nominatim (OSM) como backup
/// 3. Retorna null apenas se ambos falharem
/// </summary>
public class FallbackGeocodingService : IGeocodingService
{
    private readonly OrsGeocodingService _ors;
    private readonly NominatimGeocodingService _nominatim;
    private readonly ILogger<FallbackGeocodingService> _logger;

    public FallbackGeocodingService(
        OrsGeocodingService ors,
        NominatimGeocodingService nominatim,
        ILogger<FallbackGeocodingService> logger)
    {
        _ors = ors;
        _nominatim = nominatim;
        _logger = logger;
    }

    public async Task<(double lat, double lon)?> GeocodeAsync(string address, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            _logger.LogDebug("📍 FallbackGeocoding: endereço vazio, retornando null");
            return null;
        }

        _logger.LogInformation("📍 FallbackGeocoding: iniciando para '{Address}'", address);

        // ========================================
        // TENTATIVA 1: ORS (mais preciso para RJ)
        // ========================================
        try
        {
            _logger.LogDebug("🌍 Tentativa 1/2: chamando ORS...");
            var orsResult = await _ors.GeocodeAsync(address, ct);

            if (orsResult.HasValue)
            {
                _logger.LogInformation(
                    "✅ FallbackGeocoding: ORS encontrou coordenadas! Lat={Lat:F6}, Lon={Lon:F6} para '{Address}'",
                    orsResult.Value.lat, orsResult.Value.lon, address);
                return orsResult;
            }

            _logger.LogWarning("⚠️ ORS não encontrou coordenadas para '{Address}', tentando fallback...", address);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Erro ao chamar ORS para '{Address}', tentando fallback...", address);
        }

        // ========================================
        // TENTATIVA 2: Nominatim (fallback)
        // ========================================
        try
        {
            _logger.LogDebug("🌍 Tentativa 2/2: chamando Nominatim (OSM)...");
            var nominatimResult = await _nominatim.GeocodeAsync(address, ct);

            if (nominatimResult.HasValue)
            {
                _logger.LogInformation(
                    "✅ FallbackGeocoding: Nominatim (backup) encontrou coordenadas! Lat={Lat:F6}, Lon={Lon:F6} para '{Address}'",
                    nominatimResult.Value.lat, nominatimResult.Value.lon, address);
                return nominatimResult;
            }

            _logger.LogWarning("⚠️ Nominatim também não encontrou coordenadas para '{Address}'", address);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Erro ao chamar Nominatim para '{Address}'", address);
        }

        // ========================================
        // AMBOS FALHARAM
        // ========================================
        _logger.LogError(
            "🔥 FallbackGeocoding: AMBOS os serviços falharam para '{Address}'. Coordenadas não disponíveis.",
            address);
        return null;
    }
}
