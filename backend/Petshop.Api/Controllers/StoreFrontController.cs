using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.StoreFront;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.StoreFront;
using Petshop.Api.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Petshop.Api.Controllers;

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — configuração da loja
// ═══════════════════════════════════════════════════════════════════════════

[ApiController]
[Route("admin/storefront")]
[Authorize(Roles = "admin,gerente")]
public class StoreFrontAdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public StoreFrontAdminController(AppDbContext db) => _db = db;

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/storefront/categories ─────────────────────────────────────
    /// <summary>Lista grupos de produtos da empresa (para preencher dropdown no formulário de slide).</summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(CancellationToken ct)
    {
        var cats = await _db.Categories
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Slug })
            .ToListAsync(ct);
        return Ok(cats);
    }

    // ── GET /admin/storefront ─────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);
        return Ok(ToResponse(config));
    }

    // ── PUT /admin/storefront ─────────────────────────────────────────────────
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateStoreFrontConfigRequest req, CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);

        if (req.PrimaryColor is not null)
            config.PrimaryColor = req.PrimaryColor;
        if (req.BannerIntervalSecs.HasValue)
            config.BannerIntervalSecs = Math.Max(0, req.BannerIntervalSecs.Value);
        if (req.LogoUrl    is not null) config.LogoUrl    = req.LogoUrl == "" ? null : req.LogoUrl;
        if (req.StoreName  is not null) config.StoreName  = req.StoreName == "" ? null : req.StoreName;
        if (req.StoreSlogan is not null) config.StoreSlogan = req.StoreSlogan == "" ? null : req.StoreSlogan;
        if (req.Announcements is not null)
            config.AnnouncementsJson = JsonSerializer.Serialize(req.Announcements);

        config.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToResponse(config));
    }

    // ── POST /admin/storefront/slides ──────────────────────────────────────────
    [HttpPost("slides")]
    public async Task<IActionResult> AddSlide([FromBody] UpsertBannerSlideRequest req, CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);

        var maxOrder = config.BannerSlides.Any()
            ? config.BannerSlides.Max(s => s.SortOrder)
            : -1;

        var slide = new BannerSlide
        {
            StoreFrontConfigId = config.Id,
            ImageUrl           = req.ImageUrl,
            Title              = req.Title,
            Subtitle           = req.Subtitle,
            CtaText            = req.CtaText,
            CtaType            = NormalizeCtaType(req.CtaType),
            CtaTarget          = req.CtaTarget,
            CtaNewTab          = req.CtaNewTab ?? false,
            SortOrder          = req.SortOrder ?? maxOrder + 1,
            IsActive           = req.IsActive ?? true,
        };

        _db.BannerSlides.Add(slide);
        await _db.SaveChangesAsync(ct);
        return Ok(ToSlideResponse(slide));
    }

    // ── PUT /admin/storefront/slides/{id} ─────────────────────────────────────
    [HttpPut("slides/{id:guid}")]
    public async Task<IActionResult> UpdateSlide(Guid id, [FromBody] UpsertBannerSlideRequest req, CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);
        var slide  = config.BannerSlides.FirstOrDefault(s => s.Id == id);
        if (slide is null) return NotFound();

        if (req.ImageUrl  is not null) slide.ImageUrl  = req.ImageUrl;
        if (req.Title     is not null) slide.Title     = req.Title;
        if (req.Subtitle  is not null) slide.Subtitle  = req.Subtitle;
        if (req.CtaText   is not null) slide.CtaText   = req.CtaText;
        if (req.CtaType   is not null) slide.CtaType   = NormalizeCtaType(req.CtaType);
        if (req.CtaTarget is not null) slide.CtaTarget = req.CtaTarget;
        if (req.CtaNewTab.HasValue)    slide.CtaNewTab = req.CtaNewTab.Value;
        if (req.SortOrder.HasValue)    slide.SortOrder = req.SortOrder.Value;
        if (req.IsActive.HasValue)     slide.IsActive  = req.IsActive.Value;

        slide.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToSlideResponse(slide));
    }

    // ── DELETE /admin/storefront/slides/{id} ──────────────────────────────────
    [HttpDelete("slides/{id:guid}")]
    public async Task<IActionResult> DeleteSlide(Guid id, CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);
        var slide  = config.BannerSlides.FirstOrDefault(s => s.Id == id);
        if (slide is null) return NotFound();

        _db.BannerSlides.Remove(slide);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /admin/storefront/slides/reorder ─────────────────────────────────
    [HttpPost("slides/reorder")]
    public async Task<IActionResult> ReorderSlides([FromBody] ReorderSlidesRequest req, CancellationToken ct)
    {
        var config = await GetOrCreateConfig(ct);

        for (var i = 0; i < req.OrderedIds.Count; i++)
        {
            var slide = config.BannerSlides.FirstOrDefault(s => s.Id == req.OrderedIds[i]);
            if (slide is not null)
                slide.SortOrder = i;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(ToResponse(config));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<StoreFrontConfig> GetOrCreateConfig(CancellationToken ct)
    {
        var config = await _db.StoreFrontConfigs
            .Include(c => c.BannerSlides)
            .FirstOrDefaultAsync(c => c.CompanyId == CompanyId, ct);

        if (config is null)
        {
            config = new StoreFrontConfig { CompanyId = CompanyId };
            _db.StoreFrontConfigs.Add(config);
            await _db.SaveChangesAsync(ct);
        }

        return config;
    }

    private static string NormalizeCtaType(string? raw) =>
        raw?.ToLowerInvariant() switch
        {
            "category" => "category",
            "product"  => "product",
            "external" => "external",
            _          => "none"
        };

    private static BannerSlideResponse ToSlideResponse(BannerSlide s) => new(
        s.Id, s.ImageUrl, s.Title, s.Subtitle, s.CtaText,
        s.CtaType, s.CtaTarget, s.CtaNewTab, s.SortOrder, s.IsActive);

    private static IReadOnlyList<string> ParseAnnouncements(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? ["Frete Grátis acima de R$ 100"]; }
        catch { return ["Frete Grátis acima de R$ 100"]; }
    }

    private static StoreFrontConfigResponse ToResponse(StoreFrontConfig c) => new(
        c.Id,
        c.PrimaryColor,
        c.BannerIntervalSecs,
        c.LogoUrl,
        c.StoreName,
        c.StoreSlogan,
        ParseAnnouncements(c.AnnouncementsJson),
        c.BannerSlides
            .OrderBy(s => s.SortOrder)
            .Select(ToSlideResponse)
            .ToList());
}

// ═══════════════════════════════════════════════════════════════════════════
// PÚBLICO — catálogo lê configuração (sem auth)
// ═══════════════════════════════════════════════════════════════════════════

[ApiController]
public class StoreFrontPublicController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TenantResolverService _tenantResolver;

    public StoreFrontPublicController(AppDbContext db, TenantResolverService tenantResolver)
    {
        _db             = db;
        _tenantResolver = tenantResolver;
    }

    // GET /catalog/{slug}/storefront  — via slug na URL
    [HttpGet("catalog/{companySlug}/storefront")]
    public async Task<IActionResult> GetBySlug([FromRoute] string companySlug, CancellationToken ct)
        => await GetCore(companySlug, ct);

    // GET /catalog/storefront         — via subdomínio
    [HttpGet("catalog/storefront")]
    public async Task<IActionResult> GetByHost(CancellationToken ct)
    {
        var slug = _tenantResolver.ExtractSlug(Request.Host.Host);
        if (slug is null)
            return BadRequest(new { error = "Tenant não identificado." });
        return await GetCore(slug, ct);
    }

    private async Task<IActionResult> GetCore(string companySlug, CancellationToken ct)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Slug == companySlug && c.IsActive && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var config = await _db.StoreFrontConfigs
            .Include(c => c.BannerSlides)
            .FirstOrDefaultAsync(c => c.CompanyId == company.Id, ct);

        // Empresa ainda sem configuração → defaults
        if (config is null)
            return Ok(new StoreFrontConfigResponse(
                Guid.Empty, "#7c5cf8", 5,
                null, null, null,
                ["Frete Grátis acima de R$ 100"],
                Array.Empty<BannerSlideResponse>()));

        var slides = config.BannerSlides
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(s => new BannerSlideResponse(
                s.Id, s.ImageUrl, s.Title, s.Subtitle, s.CtaText,
                s.CtaType, s.CtaTarget, s.CtaNewTab, s.SortOrder, s.IsActive))
            .ToList();

        IReadOnlyList<string> announcements;
        try { announcements = JsonSerializer.Deserialize<List<string>>(config.AnnouncementsJson) ?? ["Frete Grátis acima de R$ 100"]; }
        catch { announcements = ["Frete Grátis acima de R$ 100"]; }

        return Ok(new StoreFrontConfigResponse(
            config.Id, config.PrimaryColor, config.BannerIntervalSecs,
            config.LogoUrl, config.StoreName, config.StoreSlogan,
            announcements,
            slides));
    }
}
