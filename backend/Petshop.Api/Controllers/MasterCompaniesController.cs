using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Master.Companies;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Delivery;
using Petshop.Api.Entities.Master;
using Petshop.Api.Models;
using Petshop.Api.Services;
using Petshop.Api.Services.Master;

namespace Petshop.Api.Controllers;

/// <summary>
/// CRUD de empresas (tenants) pelo Master Admin.
/// Todos os endpoints exigem role=master_admin e Master:Enabled=true.
/// </summary>
[ApiController]
[Route("master/companies")]
[Authorize(Roles = "master_admin")]
public class MasterCompaniesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MasterAuditService _audit;
    private readonly TenantResolverService _tenantResolver;

    public MasterCompaniesController(AppDbContext db, MasterAuditService audit, TenantResolverService tenantResolver)
    {
        _db = db;
        _audit = audit;
        _tenantResolver = tenantResolver;
    }

    // ── GET /master/companies ─────────────────────────────────

    /// <summary>
    /// Lista empresas com paginação e filtros.
    /// ?status=active|suspended|deleted|inactive (default: todas não-deletadas)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Companies.AsNoTracking();

        query = status switch
        {
            "active"    => query.Where(c => c.IsActive && !c.IsDeleted && c.SuspendedAtUtc == null),
            "suspended" => query.Where(c => c.SuspendedAtUtc != null && !c.IsDeleted),
            "inactive"  => query.Where(c => !c.IsActive && !c.IsDeleted),
            "deleted"   => query.Where(c => c.IsDeleted),
            _           => query.Where(c => !c.IsDeleted),  // padrão: todas não-deletadas
        };

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{search}%") ||
                EF.Functions.ILike(c.Slug, $"%{search}%"));

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id, c.Name, c.Slug, c.Segment, c.Plan,
                c.IsActive, c.IsDeleted, c.SuspendedAtUtc, c.CreatedAtUtc,
                HasSettings  = _db.CompanySettings.Any(s => s.CompanyId == c.Id),
                AdminCount   = _db.AdminUsers.Count(u => u.CompanyId == c.Id && u.IsActive),
            })
            .ToListAsync(ct);

        var items = rows.Select(x => new CompanyListItemDto(
            x.Id, x.Name, x.Slug, x.Segment, x.Plan,
            x.IsActive, x.IsDeleted, x.SuspendedAtUtc, x.CreatedAtUtc,
            x.HasSettings, x.AdminCount
        )).ToList();

        return Ok(new ListCompaniesResponse(items, total, page, pageSize));
    }

    // ── GET /master/companies/{id} ────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct = default)
    {
        var c = await _db.Companies.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();

        return Ok(await BuildDetailDtoAsync(id, ct));
    }

    // ── POST /master/companies ────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateCompanyRequest req,
        CancellationToken ct = default)
    {
        var slug = req.Slug.Trim().ToLowerInvariant();

        // Valida formato e reservados (regex ^[a-z0-9-]{3,63}$)
        var slugError = _tenantResolver.ValidateSlug(slug);
        if (slugError is not null)
            return BadRequest(new { error = slugError });

        if (await _db.Companies.AnyAsync(c => c.Slug == slug, ct))
            return Conflict(new { error = $"Slug '{slug}' já está em uso." });

        var company = new Company
        {
            Name    = req.Name.Trim(),
            Slug    = slug,
            Segment = req.Segment?.Trim() ?? "petshop",
            Plan    = req.Plan?.Trim() ?? "trial",
        };

        _db.Companies.Add(company);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "company.create", "company",
            company.Id.ToString(), company.Name,
            new { company.Name, company.Slug, company.Plan }, ct);

        return CreatedAtAction(nameof(Get), new { id = company.Id },
            await BuildDetailDtoAsync(company.Id, ct));
    }

    // ── PUT /master/companies/{id} ────────────────────────────

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateCompanyRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (company is null) return NotFound();

        // Slug é imutável após a criação — não incluído no UpdateCompanyRequest.
        if (req.Name is not null) company.Name = req.Name.Trim();
        if (req.Segment is not null) company.Segment = req.Segment.Trim();
        if (req.Plan is not null) company.Plan = req.Plan.Trim();
        if (req.PlanExpiresAtUtc.HasValue) company.PlanExpiresAtUtc = req.PlanExpiresAtUtc;

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "company.update", "company",
            id.ToString(), company.Name, req, ct);

        return Ok(await BuildDetailDtoAsync(id, ct));
    }

    // ── POST /master/companies/{id}/suspend ───────────────────

    [HttpPost("{id:guid}/suspend")]
    public async Task<IActionResult> Suspend(
        Guid id,
        [FromBody] SuspendCompanyRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

        if (company is null) return NotFound();
        if (company.SuspendedAtUtc is not null)
            return Conflict(new { error = "Empresa já está suspensa." });

        company.SuspendedAtUtc  = DateTime.UtcNow;
        company.SuspendedReason = req.Reason?.Trim();
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "company.suspend", "company",
            id.ToString(), company.Name, new { req.Reason }, ct);

        return NoContent();
    }

    // ── POST /master/companies/{id}/reactivate ────────────────

    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

        if (company is null) return NotFound();
        if (company.SuspendedAtUtc is null)
            return Conflict(new { error = "Empresa não está suspensa." });

        company.SuspendedAtUtc  = null;
        company.SuspendedReason = null;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "company.reactivate", "company",
            id.ToString(), company.Name, null, ct);

        return NoContent();
    }

    // ── DELETE /master/companies/{id} (soft delete) ───────────

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (company is null || company.IsDeleted) return NotFound();

        company.IsDeleted = true;
        company.IsActive  = false;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "company.delete", "company",
            id.ToString(), company.Name, null, ct);

        return NoContent();
    }

    // ── POST /master/companies/{id}/provision ─────────────────

    /// <summary>
    /// Wizard de provisionamento: cria CompanySettings + AdminUser em uma única transação.
    /// Seed de categorias/produtos/entregador é opcional e idempotente (skip se já existir).
    /// </summary>
    [HttpPost("{id:guid}/provision")]
    public async Task<IActionResult> Provision(
        Guid id,
        [FromBody] ProvisionCompanyRequest req,
        CancellationToken ct = default)
    {
        // 1. Empresa deve existir e não estar deletada
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        // 2. Username deve ser globalmente único
        var username = req.AdminUsername.Trim();
        if (await _db.AdminUsers.AnyAsync(u => u.Username == username, ct))
            return Conflict(new { error = $"Username '{username}' já está em uso." });

        // 3. Upsert CompanySettings
        bool settingsCreated = false;
        var settings = await _db.CompanySettings
            .FirstOrDefaultAsync(s => s.CompanyId == id, ct);

        if (settings is null)
        {
            settings = new CompanySettings { CompanyId = id };
            _db.CompanySettings.Add(settings);
            settingsCreated = true;
        }

        settings.SupportWhatsappE164 = req.SupportWhatsappE164?.Trim();
        settings.DepotAddress        = req.DepotAddress?.Trim();
        settings.DepotLatitude       = req.DepotLatitude;
        settings.DepotLongitude      = req.DepotLongitude;
        settings.DeliveryFixedCents  = req.DeliveryFixedCents;
        settings.MinOrderCents       = req.MinOrderCents;
        settings.EnablePix           = req.EnablePix;
        settings.EnableCard          = req.EnableCard;
        settings.EnableCash          = req.EnableCash;
        settings.UpdatedAtUtc        = DateTime.UtcNow;

        // 4. Criar AdminUser
        var adminUser = new AdminUser
        {
            CompanyId    = id,
            Username     = username,
            Email        = req.AdminEmail?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.AdminPassword),
            Role         = "admin",
        };
        _db.AdminUsers.Add(adminUser);

        // 5. Seed categorias (idempotente: só cria se a empresa não tiver nenhuma)
        int seededCategories = 0;
        List<Category> categories = new();

        if (req.SeedCategories && !await _db.Categories.AnyAsync(c => c.CompanyId == id, ct))
        {
            categories = new List<Category>
            {
                new() { Name = "Ração",      Slug = "racao",      CompanyId = id },
                new() { Name = "Petiscos",   Slug = "petiscos",   CompanyId = id },
                new() { Name = "Remédios",   Slug = "remedios",   CompanyId = id },
                new() { Name = "Acessórios", Slug = "acessorios", CompanyId = id },
                new() { Name = "Higiene",    Slug = "higiene",    CompanyId = id },
            };
            _db.Categories.AddRange(categories);
            seededCategories = categories.Count;
        }

        // 6. Salva tudo de uma vez (settings + adminUser + categorias)
        await _db.SaveChangesAsync(ct);

        // 7. Seed produtos (após SaveChanges para ter IDs de categoria)
        int seededProducts = 0;
        if (req.SeedProducts && categories.Count > 0)
        {
            Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;

            var products = new List<Product>
            {
                new() { Name = "Ração Premium",     Slug = "racao-premium",     PriceCents = 19990, CostCents = 12000, StockQty = 50,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = id, ImageUrl = "https://picsum.photos/seed/dogfood/800/600"  },
                new() { Name = "Petisco Natural",   Slug = "petisco-natural",   PriceCents =  4990, CostCents =  2500, StockQty = 100, Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = id, ImageUrl = "https://picsum.photos/seed/treats/800/600"   },
                new() { Name = "Antipulgas",        Slug = "antipulgas",        PriceCents = 29990, CostCents = 18000, StockQty = 30,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = id, ImageUrl = "https://picsum.photos/seed/flea/800/600"     },
                new() { Name = "Coleira Ajustável", Slug = "coleira-ajustavel", PriceCents = 15990, CostCents =  8000, StockQty = 20,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = id, ImageUrl = "https://picsum.photos/seed/collar/800/600"   },
                new() { Name = "Shampoo Pet",       Slug = "shampoo-pet",       PriceCents =  3990, CostCents =  1800, StockQty = 60,  Unit = "UN", CategoryId = Cat("higiene"),    CompanyId = id, ImageUrl = "https://picsum.photos/seed/shampoo/800/600"  },
            };

            foreach (var p in products)
                if (p.PriceCents > 0)
                    p.MarginPercent = Math.Round((decimal)(p.PriceCents - p.CostCents) / p.PriceCents * 100, 2);

            _db.Products.AddRange(products);
            await _db.SaveChangesAsync(ct);
            seededProducts = products.Count;
        }

        // 8. Seed entregador padrão (idempotente: skip se já tiver algum)
        bool seededDeliverer = false;
        if (req.SeedDeliverer && !await _db.Deliverers.AnyAsync(ct))
        {
            _db.Deliverers.Add(new Deliverer
            {
                Name     = "Entregador Padrão",
                Phone    = "11999999999",
                Vehicle  = "Moto",
                PinHash  = BCrypt.Net.BCrypt.HashPassword("1234"),
                IsActive = true,
            });
            await _db.SaveChangesAsync(ct);
            seededDeliverer = true;
        }

        // 9. Auditoria
        await _audit.LogAsync(User, GetIp(), "provision.complete", "company",
            id.ToString(), company.Name,
            new { AdminUsername = username, settingsCreated, seededCategories, seededProducts, seededDeliverer },
            ct);

        return Ok(new ProvisionResultDto(
            id, adminUser.Id, adminUser.Username,
            settingsCreated, seededCategories, seededProducts, seededDeliverer
        ));
    }

    // ── GET /master/companies/{id}/settings ───────────────────

    [HttpGet("{id:guid}/settings")]
    public async Task<IActionResult> GetSettings(Guid id, CancellationToken ct = default)
    {
        if (!await _db.Companies.AnyAsync(c => c.Id == id && !c.IsDeleted, ct))
            return NotFound();

        var s = await _db.CompanySettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.CompanyId == id, ct);

        if (s is null) return NotFound(new { error = "Settings não configuradas. Use o wizard de provisionamento." });

        return Ok(MapSettings(s));
    }

    // ── PUT /master/companies/{id}/settings ────────────────────

    /// <summary>
    /// Upsert completo das configurações operacionais.
    /// Campos null no request deixam o valor atual (patch semântico).
    /// </summary>
    [HttpPut("{id:guid}/settings")]
    public async Task<IActionResult> UpdateSettings(
        Guid id,
        [FromBody] UpdateSettingsRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var s = await _db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == id, ct);
        bool created = false;

        if (s is null)
        {
            s = new CompanySettings { CompanyId = id };
            _db.CompanySettings.Add(s);
            created = true;
        }

        if (req.DepotLatitude.HasValue)       s.DepotLatitude          = req.DepotLatitude;
        if (req.DepotLongitude.HasValue)      s.DepotLongitude         = req.DepotLongitude;
        if (req.DepotAddress is not null)     s.DepotAddress           = req.DepotAddress.Trim();

        if (req.CoverageRadiusKm.HasValue)    s.CoverageRadiusKm       = req.CoverageRadiusKm;
        if (req.CoveragePolygonGeoJson is not null) s.CoveragePolygonGeoJson = req.CoveragePolygonGeoJson;
        if (req.BlockedZonesGeoJson is not null)    s.BlockedZonesGeoJson    = req.BlockedZonesGeoJson;

        if (req.DeliveryFixedCents.HasValue)  s.DeliveryFixedCents     = req.DeliveryFixedCents;
        if (req.DeliveryPerKmCents.HasValue)  s.DeliveryPerKmCents     = req.DeliveryPerKmCents;
        if (req.MinOrderCents.HasValue)       s.MinOrderCents          = req.MinOrderCents;

        if (req.EnablePix.HasValue)           s.EnablePix              = req.EnablePix.Value;
        if (req.EnableCard.HasValue)          s.EnableCard             = req.EnableCard.Value;
        if (req.EnableCash.HasValue)          s.EnableCash             = req.EnableCash.Value;
        if (req.PixKey is not null)           s.PixKey                 = req.PixKey.Trim();

        if (req.PrintEnabled.HasValue)        s.PrintEnabled           = req.PrintEnabled.Value;
        if (req.PrintLayout is not null)      s.PrintLayout            = req.PrintLayout.Trim();

        if (req.SupportWhatsappE164 is not null) s.SupportWhatsappE164 = req.SupportWhatsappE164.Trim();

        s.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "settings.update", "company",
            id.ToString(), company.Name,
            new { created, req }, ct);

        return Ok(MapSettings(s));
    }

    // ── PUT /master/companies/{id}/settings/depot ──────────────

    [HttpPut("{id:guid}/settings/depot")]
    public async Task<IActionResult> UpdateDepot(
        Guid id,
        [FromBody] UpdateDepotRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var s = await _db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == id, ct);
        if (s is null) return NotFound(new { error = "Settings não configuradas. Use PUT /settings primeiro." });

        if (req.Latitude.HasValue)    s.DepotLatitude  = req.Latitude;
        if (req.Longitude.HasValue)   s.DepotLongitude = req.Longitude;
        if (req.Address is not null)  s.DepotAddress   = req.Address.Trim();
        s.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "settings.depot.update", "company",
            id.ToString(), company.Name, req, ct);

        return Ok(MapSettings(s));
    }

    // ── PUT /master/companies/{id}/settings/coverage ───────────

    [HttpPut("{id:guid}/settings/coverage")]
    public async Task<IActionResult> UpdateCoverage(
        Guid id,
        [FromBody] UpdateCoverageRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        var s = await _db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == id, ct);
        if (s is null) return NotFound(new { error = "Settings não configuradas. Use PUT /settings primeiro." });

        if (req.RadiusKm.HasValue)              s.CoverageRadiusKm       = req.RadiusKm;
        if (req.PolygonGeoJson is not null)     s.CoveragePolygonGeoJson = req.PolygonGeoJson;
        if (req.BlockedZonesGeoJson is not null) s.BlockedZonesGeoJson   = req.BlockedZonesGeoJson;
        s.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "settings.coverage.update", "company",
            id.ToString(), company.Name, req, ct);

        return Ok(MapSettings(s));
    }

    // ── Helpers ───────────────────────────────────────────────

    private string GetIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private async Task<CompanyDetailDto> BuildDetailDtoAsync(Guid id, CancellationToken ct)
    {
        var c = await _db.Companies.AsNoTracking().FirstAsync(x => x.Id == id, ct);
        var hasSettings = await _db.CompanySettings.AnyAsync(s => s.CompanyId == id, ct);
        var hasWhatsapp = await _db.CompanyIntegrationsWhatsapp.AnyAsync(w => w.CompanyId == id, ct);
        var adminCount  = await _db.AdminUsers.CountAsync(u => u.CompanyId == id && u.IsActive, ct);

        return new CompanyDetailDto(
            c.Id, c.Name, c.Slug, c.Segment, c.Plan, c.PlanExpiresAtUtc,
            c.IsActive, c.IsDeleted, c.SuspendedAtUtc, c.SuspendedReason,
            c.CreatedAtUtc, hasSettings, hasWhatsapp, adminCount
        );
    }

    private static CompanySettingsDto MapSettings(CompanySettings s) => new(
        s.Id, s.CompanyId,
        s.DepotLatitude, s.DepotLongitude, s.DepotAddress,
        s.CoverageRadiusKm, s.CoveragePolygonGeoJson, s.BlockedZonesGeoJson,
        s.DeliveryFixedCents, s.DeliveryPerKmCents, s.MinOrderCents,
        s.EnablePix, s.EnableCard, s.EnableCash, s.PixKey,
        s.PrintEnabled, s.PrintLayout,
        s.SupportWhatsappE164,
        s.CreatedAtUtc, s.UpdatedAtUtc
    );
}
