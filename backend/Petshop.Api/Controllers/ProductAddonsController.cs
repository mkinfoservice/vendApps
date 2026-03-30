using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/products/{productId:guid}/addons")]
[Authorize(Roles = "admin")]
public class ProductAddonsController : ControllerBase
{
    private readonly AppDbContext _db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    public ProductAddonsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List(Guid productId, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(
            p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null) return NotFound();

        var addons = await _db.ProductAddons
            .Where(a => a.ProductId == productId)
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
            .Select(a => new AddonDto(a.Id, a.Name, a.PriceCents, a.SortOrder, a.IsActive))
            .ToListAsync(ct);

        return Ok(addons);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid productId, [FromBody] UpsertAddonRequest req, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(
            p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null) return NotFound();

        var addon = new ProductAddon
        {
            ProductId  = productId,
            Name       = req.Name.Trim(),
            PriceCents = req.PriceCents,
            SortOrder  = req.SortOrder ?? 0,
            IsActive   = true,
        };
        _db.ProductAddons.Add(addon);

        // Garante que HasAddons está ligado
        if (!product.HasAddons)
        {
            product.HasAddons = true;
        }

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(List), new { productId }, new AddonDto(
            addon.Id, addon.Name, addon.PriceCents, addon.SortOrder, addon.IsActive));
    }

    [HttpPut("{addonId:guid}")]
    public async Task<IActionResult> Update(Guid productId, Guid addonId, [FromBody] UpsertAddonRequest req, CancellationToken ct)
    {
        var addon = await _db.ProductAddons
            .Include(a => a.Product)
            .FirstOrDefaultAsync(a => a.Id == addonId && a.ProductId == productId && a.Product.CompanyId == CompanyId, ct);
        if (addon is null) return NotFound();

        addon.Name       = req.Name.Trim();
        addon.PriceCents = req.PriceCents;
        addon.SortOrder  = req.SortOrder ?? addon.SortOrder;
        await _db.SaveChangesAsync(ct);
        return Ok(new AddonDto(addon.Id, addon.Name, addon.PriceCents, addon.SortOrder, addon.IsActive));
    }

    [HttpDelete("{addonId:guid}")]
    public async Task<IActionResult> Delete(Guid productId, Guid addonId, CancellationToken ct)
    {
        var addon = await _db.ProductAddons
            .Include(a => a.Product)
            .FirstOrDefaultAsync(a => a.Id == addonId && a.ProductId == productId && a.Product.CompanyId == CompanyId, ct);
        if (addon is null) return NotFound();

        _db.ProductAddons.Remove(addon);

        // Desliga HasAddons se não sobrar mais adicionais
        var remaining = await _db.ProductAddons.CountAsync(a => a.ProductId == productId && a.Id != addonId, ct);
        if (remaining == 0)
        {
            var product = await _db.Products.FirstAsync(p => p.Id == productId, ct);
            product.HasAddons = false;
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record AddonDto(Guid Id, string Name, int PriceCents, int SortOrder, bool IsActive);

public record UpsertAddonRequest(string Name, int PriceCents, int? SortOrder);
