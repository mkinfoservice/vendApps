using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Services.Master;

namespace Petshop.Api.Services.WhatsApp;

/// <summary>
/// Serviço de envio de mensagens via WhatsApp Cloud API (Meta Graph API).
/// Suporta credenciais globais (env vars) e por empresa (CompanyIntegrationWhatsapp).
/// NUNCA loga tokens de acesso.
/// </summary>
public class WhatsAppClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;
    private readonly MasterCryptoService _crypto;
    private readonly ILogger<WhatsAppClient> _logger;

    public WhatsAppClient(
        HttpClient http,
        IConfiguration config,
        AppDbContext db,
        MasterCryptoService crypto,
        ILogger<WhatsAppClient> logger)
    {
        _http = http;
        _config = config;
        _db = db;
        _crypto = crypto;
        _logger = logger;
    }

    // ── API pública ──────────────────────────────────────────────────────────

    /// <summary>
    /// Envia uma mensagem de texto simples.
    /// Retorna o wamid da mensagem se sucesso, null se falhar.
    /// </summary>
    public Task<string?> SendTextAsync(
        string to,
        string text,
        Guid? companyId = null,
        CancellationToken ct = default)
        => SendAsync(to, BuildTextPayload(to, text), companyId, ct);

    /// <summary>
    /// Envia um template com variáveis de texto no body.
    /// bodyParams: lista ordenada de valores para {{1}}, {{2}}, {{3}}... do template.
    /// </summary>
    public Task<string?> SendTemplateAsync(
        string to,
        string templateName,
        string languageCode,
        IReadOnlyList<string>? bodyParams = null,
        Guid? companyId = null,
        CancellationToken ct = default)
    {
        // Monta componente body com parâmetros de texto se houver variáveis
        IEnumerable<object>? components = null;
        if (bodyParams is { Count: > 0 })
        {
            components = new[]
            {
                new
                {
                    type = "body",
                    parameters = bodyParams.Select(p => new { type = "text", text = p }).ToArray()
                }
            };
        }
        return SendAsync(to, BuildTemplatePayload(to, templateName, languageCode, components), companyId, ct);
    }

    /// <summary>
    /// Envia um template com documento no header (PDF) e variáveis de texto no body.
    /// O documento é identificado pelo mediaId previamente obtido via UploadMediaAsync.
    /// </summary>
    public Task<string?> SendTemplateWithDocumentAsync(
        string to,
        string templateName,
        string languageCode,
        string mediaId,
        string filename,
        IReadOnlyList<string>? bodyParams = null,
        Guid? companyId = null,
        CancellationToken ct = default)
    {
        var components = new List<object>
        {
            new
            {
                type = "header",
                parameters = new[]
                {
                    new
                    {
                        type     = "document",
                        document = new { id = mediaId, filename }
                    }
                }
            }
        };

        if (bodyParams is { Count: > 0 })
        {
            components.Add(new
            {
                type = "body",
                parameters = bodyParams.Select(p => new { type = "text", text = p }).ToArray()
            });
        }

        return SendAsync(to, BuildTemplatePayload(to, templateName, languageCode, components), companyId, ct);
    }

    /// <summary>
    /// Faz upload de um arquivo para a API de mídia da Meta e retorna o media_id.
    /// Retorna null se falhar.
    /// </summary>
    public async Task<string?> UploadMediaAsync(
        byte[] fileBytes,
        string mimeType,
        string filename,
        Guid? companyId = null,
        CancellationToken ct = default)
    {
        var creds = await ResolveCredentialsAsync(companyId, ct);
        if (creds is null) return null;

        var (phoneNumberId, accessToken, graphVersion) = creds.Value;
        var url = $"https://graph.facebook.com/{graphVersion}/{phoneNumberId}/media";

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("whatsapp"), "messaging_product");
        form.Add(new StringContent(mimeType),   "type");

        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
        form.Add(fileContent, "file", filename);

        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WA_MEDIA_UPLOAD_ERROR | CompanyId={CompanyId} | {Message}", companyId, ex.Message);
            return null;
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("WA_MEDIA_UPLOAD_FAIL | CompanyId={CompanyId} | Status={Status} | Body={Body}",
                companyId, (int)response.StatusCode, body);
            return null;
        }

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var mediaId = doc.RootElement.GetProperty("id").GetString();
            _logger.LogInformation("WA_MEDIA_UPLOAD_OK | CompanyId={CompanyId} | MediaId={MediaId}", companyId, mediaId);
            return mediaId;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WA_MEDIA_PARSE_WARN | CompanyId={CompanyId} | Não foi possível extrair media_id", companyId);
            return null;
        }
    }

    // ── Helpers de normalização ──────────────────────────────────────────────

    /// <summary>
    /// Normaliza número de telefone brasileiro para E.164 sem "+".
    /// Ex: "(21) 99999-0000" → "5521999990000"
    /// Retorna null se o número for inválido.
    /// </summary>
    public static string? NormalizeToE164Brazil(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;

        // Remove tudo que não é dígito
        var digits = Regex.Replace(phone, @"\D", "");

        // Já está em E.164 Brasil (55 + DDD2 + 9 dígitos = 13 ou 55 + DDD2 + 8 dígitos = 12)
        if (digits.StartsWith("55") && (digits.Length == 12 || digits.Length == 13))
            return digits;

        // Tem zero inicial (0xx) → remove
        if (digits.StartsWith("0"))
            digits = digits[1..];

        // Número com DDD: 10 (fixo) ou 11 (celular) dígitos → adiciona 55
        if (digits.Length is 10 or 11)
            return "55" + digits;

        return null; // inválido
    }

    // ── Core privado ─────────────────────────────────────────────────────────

    private async Task<string?> SendAsync(
        string to,
        object payload,
        Guid? companyId,
        CancellationToken ct)
    {
        var creds = await ResolveCredentialsAsync(companyId, ct);
        if (creds is null)
        {
            _logger.LogWarning(
                "WA_SEND_SKIPPED | CompanyId={CompanyId} | To={To} | Motivo: credenciais não configuradas",
                companyId, to);
            return null;
        }

        var (phoneNumberId, accessToken, graphVersion) = creds.Value;
        var url = $"https://graph.facebook.com/{graphVersion}/{phoneNumberId}/messages";

        var json = JsonSerializer.Serialize(payload);
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "WA_HTTP_ERROR | CompanyId={CompanyId} | To={To} | Exception={Message}",
                companyId, to, ex.Message);
            return null;
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            // Loga sem expor token; body pode conter detalhes do erro da Meta
            _logger.LogError(
                "WA_API_ERROR | CompanyId={CompanyId} | To={To} | Status={Status} | Body={Body}",
                companyId, to, (int)response.StatusCode, body);
            return null;
        }

        string? wamid = null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            wamid = doc.RootElement
                .GetProperty("messages")[0]
                .GetProperty("id")
                .GetString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "WA_PARSE_WARN | CompanyId={CompanyId} | To={To} | Não foi possível extrair wamid do body",
                companyId, to);
        }

        _logger.LogInformation(
            "WA_SEND_OK | CompanyId={CompanyId} | To={To} | Wamid={Wamid}",
            companyId, to, wamid);

        return wamid;
    }

    // ── Resolução de credenciais (empresa → global env) ──────────────────────

    private async Task<(string phoneNumberId, string accessToken, string graphVersion)?> ResolveCredentialsAsync(
        Guid? companyId, CancellationToken ct)
    {
        var graphVersion = _config["WHATSAPP_GRAPH_VERSION"] ?? "v25.0";

        string companyMode = "own";
        if (companyId.HasValue)
        {
            var company = await _db.Companies
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == companyId.Value, ct);

            companyMode = (company?.WhatsappMode ?? "own").Trim().ToLowerInvariant();
            if (companyMode == "none")
                return null;
        }

        // 1️⃣ Credenciais da plataforma (modo global para o tenant)
        if (companyMode == "platform")
        {
            var platform = await _db.PlatformWhatsappConfigs
                .AsNoTracking()
                .Where(p => p.IsActive)
                .OrderByDescending(p => p.UpdatedAtUtc)
                .FirstOrDefaultAsync(ct);

            if (platform is not null &&
                !string.IsNullOrWhiteSpace(platform.PhoneNumberId) &&
                !string.IsNullOrWhiteSpace(platform.AccessTokenEncrypted))
            {
                var platformToken = _crypto.TryDecrypt(platform.AccessTokenEncrypted);
                if (!string.IsNullOrWhiteSpace(platformToken))
                {
                    _logger.LogDebug(
                        "WA_CREDS | CompanyId={CompanyId} | Usando credenciais globais da plataforma",
                        companyId);
                    return (platform.PhoneNumberId, platformToken, graphVersion);
                }
            }
        }

        // 2️⃣ Tenta credenciais por empresa (Mode=cloud_api, IsActive=true)
        if (companyId.HasValue)
        {
            var integration = await _db.CompanyIntegrationsWhatsapp
                .AsNoTracking()
                .FirstOrDefaultAsync(w =>
                    w.CompanyId == companyId.Value &&
                    w.Mode == "cloud_api" &&
                    w.IsActive, ct);

            if (integration is not null
                && !string.IsNullOrWhiteSpace(integration.PhoneNumberId)
                && !string.IsNullOrWhiteSpace(integration.AccessTokenEncrypted))
            {
                var token = _crypto.TryDecrypt(integration.AccessTokenEncrypted);
                if (!string.IsNullOrWhiteSpace(token))
                {
                    _logger.LogDebug(
                        "WA_CREDS | CompanyId={CompanyId} | Usando credenciais da empresa",
                        companyId);
                    return (integration.PhoneNumberId, token, graphVersion);
                }

                _logger.LogWarning(
                    "WA_CREDS_WARN | CompanyId={CompanyId} | Falha ao descriptografar token da empresa; fallback para env vars",
                    companyId);
            }
        }

        // 3️⃣ Fallback: credenciais globais via env vars
        var globalPhoneId = _config["WHATSAPP_PHONE_NUMBER_ID"];
        var globalToken   = _config["WHATSAPP_ACCESS_TOKEN"];

        if (!string.IsNullOrWhiteSpace(globalPhoneId) && !string.IsNullOrWhiteSpace(globalToken))
        {
            _logger.LogDebug(
                "WA_CREDS | CompanyId={CompanyId} | Usando credenciais globais (env vars)",
                companyId);
            return (globalPhoneId, globalToken, graphVersion);
        }

        return null; // Sem credenciais disponíveis
    }

    // ── Builders de payload ──────────────────────────────────────────────────

    private static object BuildTextPayload(string to, string text) => new
    {
        messaging_product = "whatsapp",
        recipient_type    = "individual",
        to,
        type = "text",
        text = new { preview_url = false, body = text }
    };

    private static object BuildTemplatePayload(
        string to,
        string templateName,
        string languageCode,
        IEnumerable<object>? components) => new
    {
        messaging_product = "whatsapp",
        recipient_type    = "individual",
        to,
        type = "template",
        template = new
        {
            name     = templateName,
            language = new { code = languageCode },
            components = components ?? Array.Empty<object>()
        }
    };
}
