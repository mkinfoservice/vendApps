using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Services;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("catalog/{companySlug}")]
public class CatalogController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TenantResolverService _tenantResolver;

    public CatalogController(AppDbContext db, TenantResolverService tenantResolver)
    {
        _db = db;
        _tenantResolver = tenantResolver;
    }

    // ── Via slug na rota ─────────────────────────────────────────────

    /// <summary>Lista categorias da empresa identificada pelo slug. Ex: GET /catalog/petshop-demo/categories</summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories([FromRoute] string companySlug, CancellationToken ct)
        => await GetCategoriesCore(companySlug, ct);

    /// <summary>
    /// Lista produtos ativos da empresa identificada pelo slug.
    /// Ex: GET /catalog/petshop-demo/products?search=racao&categorySlug=racao
    /// </summary>
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromRoute] string companySlug,
        [FromQuery] string? categorySlug,
        [FromQuery] string? search,
        CancellationToken ct)
        => await GetProductsCore(companySlug, categorySlug, search, ct);

    // ── Via Host header (subdomínio) ─────────────────────────────────

    /// <summary>Lista categorias resolvendo a empresa pelo Host header. Ex: GET /catalog/categories (em minhaloja.vendapps.com.br)</summary>
    [HttpGet("/catalog/categories")]
    public async Task<IActionResult> GetCategoriesByHost(CancellationToken ct)
    {
        var slug = _tenantResolver.ExtractSlug(Request.Host.Host);
        if (slug is null)
            return BadRequest(new { error = "Tenant não identificado. Use /catalog/{slug}/categories" });

        return await GetCategoriesCore(slug, ct);
    }

    /// <summary>Lista produtos resolvendo a empresa pelo Host header. Ex: GET /catalog/products (em minhaloja.vendapps.com.br)</summary>
    [HttpGet("/catalog/products")]
    public async Task<IActionResult> GetProductsByHost(
        [FromQuery] string? categorySlug,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var slug = _tenantResolver.ExtractSlug(Request.Host.Host);
        if (slug is null)
            return BadRequest(new { error = "Tenant não identificado. Use /catalog/{slug}/products" });

        return await GetProductsCore(slug, categorySlug, search, ct);
    }

    // ── Helpers privados ─────────────────────────────────────────────

    private async Task<IActionResult> GetCategoriesCore(string companySlug, CancellationToken ct)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == companySlug, ct);

        if (company == null || company.IsDeleted || !company.IsActive)
            return NotFound("Empresa não encontrada.");

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new { error = "Empresa temporariamente indisponível." });

        var categories = await _db.Categories
            .AsNoTracking()
            .Where(c => c.CompanyId == company.Id)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Slug, c.SortOrder })
            .ToListAsync(ct);

        return Ok(categories);
    }

    private async Task<IActionResult> GetProductsCore(
        string companySlug,
        string? categorySlug,
        string? search,
        CancellationToken ct)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == companySlug, ct);

        if (company == null || company.IsDeleted || !company.IsActive)
            return NotFound("Empresa não encontrada.");

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new { error = "Empresa temporariamente indisponível." });

        var query = _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == company.Id && p.IsActive && !p.IsSupply)
            .Include(p => p.Category)
            .Include(p => p.Variants.Where(v => v.IsActive))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(categorySlug))
            query = query.Where(p => p.Category.Slug == categorySlug);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%"));

        var products = await query
            .OrderBy(p => p.Category.SortOrder).ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.PriceCents,
                p.ImageUrl,
                p.Description,
                p.IsFeatured,
                p.IsBestSeller,
                p.DiscountPercent,
                Category = new { p.Category.Id, p.Category.Name, p.Category.Slug },
                Variants = p.Variants
                    .Where(v => v.IsActive)
                    .OrderBy(v => v.PriceCents)
                    .Select(v => new { v.Id, v.VariantKey, v.VariantValue, v.PriceCents })
            })
            .ToListAsync(ct);

        return Ok(products);
    }
}
