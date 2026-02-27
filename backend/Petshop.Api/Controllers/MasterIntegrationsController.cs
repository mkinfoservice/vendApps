using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Master.Companies;
using Petshop.Api.Data;
using Petshop.Api.Entities.Master;
using Petshop.Api.Services.Master;

namespace Petshop.Api.Controllers;

/// <summary>
/// Gerencia integrações de cada empresa (tenant) pelo Master Admin.
/// Todos os endpoints exigem role=master_admin e Master:Enabled=true.
/// </summary>
[ApiController]
[Route("master/companies/{companyId:guid}/integrations")]
[Authorize(Roles = "master_admin")]
public class MasterIntegrationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MasterAuditService _audit;
    private readonly MasterCryptoService _crypto;

    public MasterIntegrationsController(AppDbContext db, MasterAuditService audit, MasterCryptoService crypto)
    {
        _db = db;
        _audit = audit;
        _crypto = crypto;
    }

    // ── GET /master/companies/{companyId}/integrations/whatsapp ───

    [HttpGet("whatsapp")]
    public async Task<IActionResult> GetWhatsapp(Guid companyId, CancellationToken ct = default)
    {
        if (!await _db.Companies.AnyAsync(c => c.Id == companyId && !c.IsDeleted, ct))
            return NotFound();

        var w = await _db.CompanyIntegrationsWhatsapp
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.CompanyId == companyId, ct);

        if (w is null)
            return NotFound(new { error = "Integração WhatsApp não configurada." });

        return Ok(MapWhatsapp(w));
    }

    // ── PUT /master/companies/{companyId}/integrations/whatsapp ───

    /// <summary>
    /// Cria ou atualiza a integração WhatsApp da empresa.
    /// Mode="link"      → usa SupportWhatsappE164 (CompanySettings) para links de checkout.
    /// Mode="cloud_api" → usa WABA + PhoneNumberId para automações.
    /// O AccessToken é criptografado com Data Protection e nunca retornado na resposta.
    /// </summary>
    [HttpPut("whatsapp")]
    public async Task<IActionResult> UpsertWhatsapp(
        Guid companyId,
        [FromBody] UpsertWhatsappRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var mode = req.Mode.Trim().ToLowerInvariant();
        if (mode != "link" && mode != "cloud_api")
            return BadRequest(new { error = "Mode deve ser 'link' ou 'cloud_api'." });

        var w = await _db.CompanyIntegrationsWhatsapp
            .FirstOrDefaultAsync(w => w.CompanyId == companyId, ct);

        bool created = false;
        if (w is null)
        {
            w = new CompanyIntegrationWhatsapp { CompanyId = companyId };
            _db.CompanyIntegrationsWhatsapp.Add(w);
            created = true;
        }

        w.Mode = mode;

        if (req.WabaId is not null)                    w.WabaId                      = req.WabaId.Trim();
        if (req.PhoneNumberId is not null)             w.PhoneNumberId               = req.PhoneNumberId.Trim();
        if (req.AccessToken is not null)               w.AccessTokenEncrypted        = _crypto.Encrypt(req.AccessToken);
        if (req.WebhookSecret is not null)             w.WebhookSecret               = req.WebhookSecret.Trim();
        if (req.NotifyOnStatuses is not null)          w.NotifyOnStatuses            = req.NotifyOnStatuses;
        if (req.NotificationTemplatesJson is not null) w.NotificationTemplatesJson   = req.NotificationTemplatesJson;
        if (req.TemplateLanguageCode is not null)      w.TemplateLanguageCode        = req.TemplateLanguageCode.Trim();
        if (req.IsActive.HasValue)                     w.IsActive                    = req.IsActive.Value;

        w.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "whatsapp.upsert", "company",
            companyId.ToString(), company.Name,
            new
            {
                created,
                mode       = w.Mode,
                wabaId     = w.WabaId,
                phoneId    = w.PhoneNumberId,
                isActive   = w.IsActive,
                tokenUpdated = req.AccessToken is not null,
            }, ct);

        return Ok(MapWhatsapp(w));
    }

    // ── DELETE /master/companies/{companyId}/integrations/whatsapp ─

    [HttpDelete("whatsapp")]
    public async Task<IActionResult> DeleteWhatsapp(Guid companyId, CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var w = await _db.CompanyIntegrationsWhatsapp
            .FirstOrDefaultAsync(w => w.CompanyId == companyId, ct);

        if (w is null)
            return NotFound(new { error = "Integração WhatsApp não configurada." });

        _db.CompanyIntegrationsWhatsapp.Remove(w);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "whatsapp.delete", "company",
            companyId.ToString(), company.Name, null, ct);

        return NoContent();
    }

    // ── Helpers ────────────────────────────────────────────────────

    private string GetIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static WhatsappIntegrationDto MapWhatsapp(CompanyIntegrationWhatsapp w) => new(
        w.Id,
        w.CompanyId,
        w.Mode,
        w.WabaId,
        w.PhoneNumberId,
        w.AccessTokenEncrypted is not null,   // HasAccessToken — token nunca é exposto
        w.WebhookSecret,
        w.NotifyOnStatuses,
        w.NotificationTemplatesJson,
        w.TemplateLanguageCode,
        w.IsActive,
        w.CreatedAtUtc,
        w.UpdatedAtUtc
    );
}
