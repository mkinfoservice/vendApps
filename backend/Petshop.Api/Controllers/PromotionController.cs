using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Promotions;
using Petshop.Api.Services.Promotions;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

// ── Admin catalog lookups ─────────────────────────────────────────────────────

[ApiController]
[Route("admin/catalog")]
[Authorize(Roles = "admin,gerente")]
public class AdminCatalogLookupController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminCatalogLookupController(AppDbContext db) => _db = db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct) =>
        Ok(await _db.Categories.AsNoTracking()
            .Where(c => c.CompanyId == CompanyId)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync(ct));

    [HttpGet("brands")]
    public async Task<IActionResult> Brands(CancellationToken ct) =>
        Ok(await _db.Brands.AsNoTracking()
            .Where(b => b.CompanyId == CompanyId && b.IsActive)
            .OrderBy(b => b.Name)
            .Select(b => new { b.Id, b.Name })
            .ToListAsync(ct));
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

[ApiController]
[Route("admin/promotions")]
[Authorize(Roles = "admin,gerente")]
public class PromotionController : ControllerBase
{
    private readonly AppDbContext   _db;
    private readonly PromotionEngine _engine;

    public PromotionController(AppDbContext db, PromotionEngine engine)
    {
        _db     = db;
        _engine = engine;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // GET /admin/promotions
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool? active = null,
        CancellationToken ct = default)
    {
        var q = _db.Promotions.AsNoTracking()
            .Where(p => p.CompanyId == CompanyId);

        if (active.HasValue) q = q.Where(p => p.IsActive == active.Value);

        var now  = DateTime.UtcNow;
        var list = await q
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new PromotionDto(
                p.Id, p.Name, p.Description, p.IsActive,
                p.Type.ToString(), p.Scope.ToString(),
                p.TargetId, p.TargetName,
                p.Value, p.CouponCode,
                p.MinOrderCents, p.MaxDiscountCents,
                p.StartsAtUtc, p.ExpiresAtUtc, p.CreatedAtUtc,
                p.ExpiresAtUtc == null
                    ? "active"
                    : (p.ExpiresAtUtc < now ? "expired"
                    : (p.StartsAtUtc > now ? "scheduled" : "active"))
            ))
            .ToListAsync(ct);

        return Ok(list);
    }

    // POST /admin/promotions
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertPromotionRequest req, CancellationToken ct)
    {
        var promo = Map(req, new Promotion { CompanyId = CompanyId });
        _db.Promotions.Add(promo);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = promo.Id }, ToDto(promo));
    }

    // GET /admin/promotions/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var p = await _db.Promotions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        return p is null ? NotFound() : Ok(ToDto(p));
    }

    // PUT /admin/promotions/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertPromotionRequest req, CancellationToken ct)
    {
        var p = await _db.Promotions
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (p is null) return NotFound();
        Map(req, p);
        p.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(p));
    }

    // PATCH /admin/promotions/{id}/toggle
    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
    {
        var p = await _db.Promotions
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (p is null) return NotFound();
        p.IsActive     = !p.IsActive;
        p.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { p.Id, p.IsActive });
    }

    // DELETE /admin/promotions/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var p = await _db.Promotions
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (p is null) return NotFound();
        _db.Promotions.Remove(p);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Promotion Map(UpsertPromotionRequest req, Promotion p)
    {
        p.Name            = req.Name.Trim();
        p.Description     = req.Description;
        p.IsActive        = req.IsActive;
        p.Type            = Enum.Parse<PromotionType>(req.Type);
        p.Scope           = Enum.Parse<PromotionScope>(req.Scope);
        p.TargetId        = req.TargetId;
        p.TargetName      = req.TargetName?.Trim();
        p.Value           = req.Value;
        p.CouponCode      = req.CouponCode?.Trim().ToUpper();
        p.MinOrderCents   = req.MinOrderCents;
        p.MaxDiscountCents = req.MaxDiscountCents;
        p.StartsAtUtc     = req.StartsAtUtc;
        p.ExpiresAtUtc    = req.ExpiresAtUtc;
        return p;
    }

    private static PromotionDto ToDto(Promotion p)
    {
        var now = DateTime.UtcNow;
        return new PromotionDto(
            p.Id, p.Name, p.Description, p.IsActive,
            p.Type.ToString(), p.Scope.ToString(),
            p.TargetId, p.TargetName,
            p.Value, p.CouponCode,
            p.MinOrderCents, p.MaxDiscountCents,
            p.StartsAtUtc, p.ExpiresAtUtc, p.CreatedAtUtc,
            p.ExpiresAtUtc == null
                ? "active"
                : (p.ExpiresAtUtc < now ? "expired"
                : (p.StartsAtUtc > now ? "scheduled" : "active"))
        );
    }
}

// ── PDV evaluation endpoint ───────────────────────────────────────────────────

[ApiController]
[Route("pdv/promotions")]
[Authorize(Roles = "admin,gerente,atendente,caixa")]
public class PdvPromotionController : ControllerBase
{
    private readonly PromotionEngine _engine;
    public PdvPromotionController(PromotionEngine engine) => _engine = engine;

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    /// <summary>
    /// Avalia promoções disponíveis para um carrinho.
    /// </summary>
    [HttpGet("evaluate")]
    public async Task<IActionResult> Evaluate(
        [FromQuery] int    totalCents,
        [FromQuery] string? coupon = null,
        CancellationToken  ct = default)
    {
        var results = await _engine.EvaluateSimpleAsync(CompanyId, totalCents, coupon, ct);
        return Ok(results);
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record PromotionDto(
    Guid      Id,
    string    Name,
    string?   Description,
    bool      IsActive,
    string    Type,       // "PercentDiscount" | "FixedAmount"
    string    Scope,      // "All" | "Category" | "Brand" | "Product"
    Guid?     TargetId,
    string?   TargetName,
    decimal   Value,
    string?   CouponCode,
    int?      MinOrderCents,
    int?      MaxDiscountCents,
    DateTime? StartsAtUtc,
    DateTime? ExpiresAtUtc,
    DateTime  CreatedAtUtc,
    string    Status      // "active" | "expired" | "scheduled"
);

public record UpsertPromotionRequest(
    [Required, MaxLength(120)] string Name,
    bool    IsActive,
    string  Type,   // "PercentDiscount" | "FixedAmount"
    string  Scope,  // "All" | "Category" | "Brand" | "Product"
    decimal Value,
    string?   Description     = null,
    Guid?     TargetId        = null,
    string?   TargetName      = null,
    string?   CouponCode      = null,
    int?      MinOrderCents   = null,
    int?      MaxDiscountCents = null,
    DateTime? StartsAtUtc     = null,
    DateTime? ExpiresAtUtc    = null
);
