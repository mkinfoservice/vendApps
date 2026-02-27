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

        // 1️⃣ Tenta credenciais por empresa (Mode=cloud_api, IsActive=true)
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

        // 2️⃣ Fallback: credenciais globais via env vars
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
