using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Services;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("public/tenant")]
public class PublicTenantController : ControllerBase
{
    private readonly TenantResolverService _resolver;
    private readonly AppDbContext _db;

    public PublicTenantController(TenantResolverService resolver, AppDbContext db)
    {
        _resolver = resolver;
        _db = db;
    }

    /// <summary>
    /// Resolve o tenant pelo Host header.
    /// Usado pelo frontend para validar o subdomínio antes de renderizar a loja.
    /// </summary>
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve(CancellationToken ct)
    {
        // Request.Host.Host já exclui a porta
        var slug = _resolver.ExtractSlug(Request.Host.Host);

        if (slug is null)
            return NotFound(new { error = "Tenant não identificado para este host." });

        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == slug, ct);

        if (company is null || company.IsDeleted || !company.IsActive)
            return NotFound(new { error = "Empresa não encontrada." });

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new
            {
                error = "Empresa temporariamente indisponível.",
                slug = company.Slug,
                suspendedAtUtc = company.SuspendedAtUtc
            });

        return Ok(new
        {
            slug = company.Slug,
            name = company.Name,
            companyId = company.Id,
            isActive = company.IsActive,
            suspendedAtUtc = (DateTime?)null
        });
    }
}
