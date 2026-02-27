using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Services.WhatsApp;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoints internos de administração da integração WhatsApp.
/// Acessíveis apenas por usuários autenticados (admin ou master_admin).
/// Nunca expõem tokens ou segredos.
/// </summary>
[ApiController]
[Route("admin/whatsapp")]
[Authorize(Roles = "admin,master_admin")]
public class WhatsAppAdminController : ControllerBase
{
    private readonly WhatsAppClient _wa;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppAdminController> _logger;

    public WhatsAppAdminController(
        WhatsAppClient wa,
        AppDbContext db,
        IConfiguration config,
        ILogger<WhatsAppAdminController> logger)
    {
        _wa = wa;
        _db = db;
        _config = config;
        _logger = logger;
    }

    // ── POST /admin/whatsapp/test-send ────────────────────────────────────────

    /// <summary>
    /// Envia uma mensagem de texto de teste via WhatsApp Cloud API.
    /// Útil para validar credenciais sem precisar criar um pedido real.
    ///
    /// Admin de empresa: usa o companyId do JWT.
    /// Master admin:     usa o companyId do body (obrigatório).
    /// </summary>
    [HttpPost("test-send")]
    public async Task<IActionResult> TestSend(
        [FromBody] TestSendRequest req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.To))
            return BadRequest(new { error = "Campo 'to' é obrigatório." });
        if (string.IsNullOrWhiteSpace(req.Text))
            return BadRequest(new { error = "Campo 'text' é obrigatório." });

        // Normaliza número para E.164 (aceita formatos variados)
        var waId = WhatsAppClient.NormalizeToE164Brazil(req.To);
        if (waId is null)
            return BadRequest(new
            {
                error = "Número de telefone inválido. Use formato brasileiro: (21) 99999-0000 ou 5521999990000."
            });

        // Resolve companyId: JWT (admin) ou body (master_admin)
        Guid? companyId = null;
        var role = User.FindFirstValue(ClaimTypes.Role);

        if (role == "admin")
        {
            var jwtCompanyId = User.FindFirstValue("companyId");
            if (Guid.TryParse(jwtCompanyId, out var cid))
                companyId = cid;
        }
        else if (role == "master_admin")
        {
            if (req.CompanyId.HasValue)
                companyId = req.CompanyId;
            // Se não informado, usa env vars globais (companyId = null → fallback global)
        }

        _logger.LogInformation(
            "WA_TEST_SEND | User={User} | Role={Role} | CompanyId={CompanyId} | To={To}",
            User.Identity?.Name, role, companyId, waId);

        var wamid = await _wa.SendTextAsync(waId, req.Text, companyId, ct);

        if (wamid is null)
            return StatusCode(502, new
            {
                error   = "Falha ao enviar mensagem. Verifique credenciais e logs do servidor.",
                to      = waId,
                companyId
            });

        return Ok(new
        {
            success   = true,
            wamid,
            to        = waId,
            companyId,
            message   = "Mensagem enviada com sucesso."
        });
    }

    // ── GET /admin/whatsapp/health ────────────────────────────────────────────

    /// <summary>
    /// Verifica se as variáveis de ambiente e configuração da empresa estão presentes.
    /// Nunca retorna valores de tokens — apenas indica presença (true/false).
    /// </summary>
    [HttpGet("health")]
    public async Task<IActionResult> Health(CancellationToken ct = default)
    {
        // ── Env vars globais ────────────────────────────────────────────────
        var globalHealth = new
        {
            hasAccessToken    = !string.IsNullOrWhiteSpace(_config["WHATSAPP_ACCESS_TOKEN"]),
            hasPhoneNumberId  = !string.IsNullOrWhiteSpace(_config["WHATSAPP_PHONE_NUMBER_ID"]),
            hasVerifyToken    = !string.IsNullOrWhiteSpace(_config["WHATSAPP_VERIFY_TOKEN"]),
            hasAppSecret      = !string.IsNullOrWhiteSpace(_config["META_APP_SECRET"]),
            graphVersion      = _config["WHATSAPP_GRAPH_VERSION"] ?? "v25.0 (padrão)",
            phoneNumberId     = MaskValue(_config["WHATSAPP_PHONE_NUMBER_ID"])
        };

        // ── Config da empresa (admin de tenant) ────────────────────────────
        object? companyHealth = null;
        var jwtCompanyId = User.FindFirstValue("companyId");

        if (Guid.TryParse(jwtCompanyId, out var companyId))
        {
            var integration = await _db.CompanyIntegrationsWhatsapp
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.CompanyId == companyId, ct);

            companyHealth = integration is null
                ? new { configured = false }
                : new
                {
                    configured     = true,
                    mode           = integration.Mode,
                    isActive       = integration.IsActive,
                    hasAccessToken = integration.AccessTokenEncrypted is not null,
                    hasPhoneNumberId = !string.IsNullOrWhiteSpace(integration.PhoneNumberId),
                    wabaId         = MaskValue(integration.WabaId),
                    phoneNumberId  = MaskValue(integration.PhoneNumberId),
                    notifyOnStatuses = integration.NotifyOnStatuses
                };
        }

        var allOk = globalHealth.hasAccessToken && globalHealth.hasPhoneNumberId && globalHealth.hasVerifyToken;

        return Ok(new
        {
            status        = allOk ? "ok" : "incomplete",
            globalEnvVars = globalHealth,
            companyConfig = companyHealth
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Oculta valor sensível exibindo apenas os primeiros e últimos 3 caracteres.</summary>
    private static string? MaskValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (value.Length <= 8) return "***";
        return $"{value[..3]}***{value[^3..]}";
    }
}

// ── Contratos ─────────────────────────────────────────────────────────────────

public record TestSendRequest(
    string To,
    string Text,
    Guid? CompanyId = null
);
