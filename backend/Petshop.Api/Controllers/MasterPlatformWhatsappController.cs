using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Master;
using Petshop.Api.Services.Master;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("master/integrations/whatsapp/platform")]
[Authorize(Roles = "master_admin")]
public class MasterPlatformWhatsappController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MasterCryptoService _crypto;

    public MasterPlatformWhatsappController(AppDbContext db, MasterCryptoService crypto)
    {
        _db = db;
        _crypto = crypto;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct = default)
    {
        var cfg = await _db.PlatformWhatsappConfigs
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (cfg is null)
            return Ok(new PlatformWhatsappConfigDto(null, null, false, "pt_BR", false));

        return Ok(new PlatformWhatsappConfigDto(
            cfg.WabaId,
            cfg.PhoneNumberId,
            cfg.AccessTokenEncrypted is not null,
            cfg.TemplateLanguageCode,
            cfg.IsActive
        ));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertPlatformWhatsappConfigRequest req, CancellationToken ct = default)
    {
        var cfg = await _db.PlatformWhatsappConfigs
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (cfg is null)
        {
            cfg = new PlatformWhatsappConfig();
            _db.PlatformWhatsappConfigs.Add(cfg);
        }

        if (req.WabaId is not null) cfg.WabaId = req.WabaId.Trim();
        if (req.PhoneNumberId is not null) cfg.PhoneNumberId = req.PhoneNumberId.Trim();
        if (req.AccessToken is not null) cfg.AccessTokenEncrypted = _crypto.Encrypt(req.AccessToken);
        if (req.TemplateLanguageCode is not null) cfg.TemplateLanguageCode = req.TemplateLanguageCode.Trim();
        if (req.IsActive.HasValue) cfg.IsActive = req.IsActive.Value;

        cfg.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new PlatformWhatsappConfigDto(
            cfg.WabaId,
            cfg.PhoneNumberId,
            cfg.AccessTokenEncrypted is not null,
            cfg.TemplateLanguageCode,
            cfg.IsActive
        ));
    }
}

public record PlatformWhatsappConfigDto(
    string? WabaId,
    string? PhoneNumberId,
    bool HasAccessToken,
    string TemplateLanguageCode,
    bool IsActive
);

public record UpsertPlatformWhatsappConfigRequest(
    string? WabaId,
    string? PhoneNumberId,
    string? AccessToken,
    string? TemplateLanguageCode,
    bool? IsActive
);
