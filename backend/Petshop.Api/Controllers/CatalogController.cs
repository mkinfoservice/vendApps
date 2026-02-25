using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("catalog/{companySlug}")]
public class CatalogController : ControllerBase
{
    private readonly AppDbContext _db;

    public CatalogController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>Lista categorias da empresa identificada pelo slug. Ex: GET /catalog/petshop-demo/categories</summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories([FromRoute] string companySlug)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == companySlug);

        if (company == null || company.IsDeleted || !company.IsActive)
            return NotFound("Empresa não encontrada.");

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new { error = "Empresa temporariamente indisponível." });

        var categories = await _db.Categories
            .AsNoTracking()
            .Where(c => c.CompanyId == company.Id)
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Slug })
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Lista produtos ativos da empresa identificada pelo slug.
    /// Ex: GET /catalog/petshop-demo/products?search=racao&categorySlug=racao
    /// </summary>
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromRoute] string companySlug,
        [FromQuery] string? categorySlug,
        [FromQuery] string? search)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == companySlug);

        if (company == null || company.IsDeleted || !company.IsActive)
            return NotFound("Empresa não encontrada.");

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new { error = "Empresa temporariamente indisponível." });

        var query = _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == company.Id && p.IsActive)
            .Include(p => p.Category)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(categorySlug))
            query = query.Where(p => p.Category.Slug == categorySlug);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%"));

        var products = await query
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.PriceCents,
                p.ImageUrl,
                Category = new { p.Category.Id, p.Category.Name, p.Category.Slug }
            })
            .ToListAsync();

        return Ok(products);
    }
}
