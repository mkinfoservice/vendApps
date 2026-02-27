using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Petshop.Api.Services.WhatsApp;

namespace Petshop.Api.Controllers;

/// <summary>
/// Webhook da Meta (WhatsApp Cloud API).
/// GET  /webhook — verificação do endpoint pelo Meta Dashboard.
/// POST /webhook — recebe eventos (messages / statuses).
///
/// IMPORTANTE: POST responde 200 imediatamente e delega processamento
/// ao Hangfire (WhatsAppWebhookProcessor). Nunca bloqueia a fila da Meta.
/// </summary>
[ApiController]
[Route("webhook")]
public class WhatsAppWebhookController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IBackgroundJobClient _jobs;
    private readonly ILogger<WhatsAppWebhookController> _logger;

    public WhatsAppWebhookController(
        IConfiguration config,
        IBackgroundJobClient jobs,
        ILogger<WhatsAppWebhookController> logger)
    {
        _config = config;
        _jobs = jobs;
        _logger = logger;
    }

    // ── GET /webhook ──────────────────────────────────────────────────────────
    // Meta faz GET para verificar o endpoint ao configurar o webhook no dashboard.

    [HttpGet]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")]         string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")]    string? challenge)
    {
        _logger.LogInformation(
            "WH_VERIFY | Mode={Mode} | TokenOk={TokenOk}",
            mode, verifyToken == _config["WHATSAPP_VERIFY_TOKEN"]);

        if (mode != "subscribe")
            return BadRequest(new { error = "hub.mode deve ser 'subscribe'." });

        var expectedToken = _config["WHATSAPP_VERIFY_TOKEN"];
        if (string.IsNullOrWhiteSpace(expectedToken))
        {
            _logger.LogError("WH_VERIFY_ERROR | WHATSAPP_VERIFY_TOKEN não configurado");
            return StatusCode(500, new { error = "Verify token não configurado no servidor." });
        }

        if (!string.Equals(verifyToken, expectedToken, StringComparison.Ordinal))
        {
            _logger.LogWarning("WH_VERIFY_FAIL | Token recebido não confere");
            return Unauthorized(new { error = "Verify token inválido." });
        }

        // Retorna o challenge como texto puro — obrigatório pelo protocolo Meta
        _logger.LogInformation("WH_VERIFY_OK | Challenge retornado com sucesso");
        return Content(challenge ?? "", "text/plain");
    }

    // ── POST /webhook ─────────────────────────────────────────────────────────
    // Meta envia eventos em JSON. Deve responder 200 em < 20s.

    [HttpPost]
    public async Task<IActionResult> Receive(CancellationToken ct = default)
    {
        // 1. Habilita buffering para poder ler o body duas vezes (sig + deserialize)
        Request.EnableBuffering();

        byte[] bodyBytes;
        using (var ms = new MemoryStream())
        {
            await Request.Body.CopyToAsync(ms, ct);
            bodyBytes = ms.ToArray();
        }
        Request.Body.Seek(0, SeekOrigin.Begin);

        // 2. Validação HMAC-SHA256 (opcional mas recomendada — ativa se META_APP_SECRET existir)
        var appSecret = _config["META_APP_SECRET"];
        if (!string.IsNullOrWhiteSpace(appSecret))
        {
            var signatureHeader = Request.Headers["X-Hub-Signature-256"].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(signatureHeader))
            {
                _logger.LogWarning("WH_SIG_MISSING | X-Hub-Signature-256 ausente — rejeitando");
                return Unauthorized(new { error = "Assinatura ausente." });
            }

            if (!IsSignatureValid(bodyBytes, signatureHeader, appSecret))
            {
                _logger.LogWarning("WH_SIG_INVALID | Assinatura HMAC-SHA256 inválida");
                return Unauthorized(new { error = "Assinatura inválida." });
            }
        }
        else
        {
            _logger.LogDebug("WH_SIG_SKIP | META_APP_SECRET não configurado — validação de assinatura desabilitada");
        }

        // 3. Deserializa para verificação rápida do objeto (sem processar aqui)
        var payloadJson = Encoding.UTF8.GetString(bodyBytes);

        string? objectType = null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            doc.RootElement.TryGetProperty("object", out var objProp);
            objectType = objProp.GetString();
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "WH_PARSE_ERROR | Body não é JSON válido");
            // Ainda retorna 200 para evitar que a Meta pare de enviar
            return Ok();
        }

        if (objectType != "whatsapp_business_account")
        {
            _logger.LogDebug("WH_SKIP | object={Object} | Não é whatsapp_business_account", objectType);
            return Ok();
        }

        // 4. Enfileira no Hangfire e responde 200 imediatamente
        var jobId = _jobs.Enqueue<WhatsAppWebhookProcessor>(
            p => p.ProcessAsync(payloadJson, CancellationToken.None));

        _logger.LogInformation("WH_ENQUEUED | JobId={JobId}", jobId);

        return Ok();
    }

    // ── HMAC-SHA256 ───────────────────────────────────────────────────────────

    private static bool IsSignatureValid(byte[] body, string signatureHeader, string appSecret)
    {
        // Header format: "sha256=<hex>"
        if (!signatureHeader.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
            return false;

        var receivedHex = signatureHeader["sha256=".Length..];

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var computed = hmac.ComputeHash(body);
        var computedHex = Convert.ToHexString(computed).ToLowerInvariant();

        // Comparação em tempo constante para evitar timing attacks
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHex),
            Encoding.UTF8.GetBytes(receivedHex.ToLowerInvariant()));
    }
}
