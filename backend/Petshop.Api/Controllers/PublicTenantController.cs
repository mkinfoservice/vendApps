using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Services;
using Petshop.Api.Services.Tenancy;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("public/tenant")]
public class PublicTenantController : ControllerBase
{
    private readonly TenantResolverService _resolver;
    private readonly AppDbContext _db;
    private readonly PlanFeatureService _features;

    public PublicTenantController(TenantResolverService resolver, AppDbContext db, PlanFeatureService features)
    {
        _resolver = resolver;
        _db = db;
        _features = features;
    }

    /// <summary>
    /// Resolve o tenant pelo slug (query param) ou pelo Host header.
    /// Aceita ?slug=novaempresa para frontends em domínio diferente do API
    /// (ex: Vercel SPA + Render API). Fallback: extrai do Host header.
    /// </summary>
    [HttpGet("resolve")]
    [EnableRateLimiting("public_api")]
    public async Task<IActionResult> Resolve([FromQuery] string? slug, CancellationToken ct)
    {
        var resolvedSlug = slug?.Trim().ToLowerInvariant()
                           ?? _resolver.ExtractSlug(Request.Host.Host);

        if (resolvedSlug is null)
            return NotFound(new { error = "Tenant não identificado." });

        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == resolvedSlug, ct);

        if (company is null || company.IsDeleted || !company.IsActive)
            return NotFound(new { error = "Empresa não encontrada." });

        if (company.SuspendedAtUtc is not null)
            return StatusCode(403, new
            {
                error = "Empresa temporariamente indisponível.",
                slug = company.Slug,
                suspendedAtUtc = company.SuspendedAtUtc
            });

        var features = await _features.ResolveFeaturesAsync(company, ct);

        return Ok(new
        {
            slug = company.Slug,
            name = company.Name,
            companyId = company.Id,
            plan = company.Plan,
            isActive = company.IsActive,
            suspendedAtUtc = (DateTime?)null,
            features
        });
    }
}
