using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Services.Tenancy;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("master/companies/{companyId:guid}/features")]
[Authorize(Roles = "master_admin")]
public class MasterCompanyFeaturesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PlanFeatureService _features;

    public MasterCompanyFeaturesController(AppDbContext db, PlanFeatureService features)
    {
        _db = db;
        _features = features;
    }

    [HttpGet]
    public async Task<IActionResult> Get(Guid companyId, CancellationToken ct = default)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId && !c.IsDeleted, ct);

        if (company is null) return NotFound();

        var resolved = await _features.ResolveFeaturesAsync(company, ct);
        return Ok(new { companyId = company.Id, plan = company.Plan, features = resolved });
    }

    [HttpPut]
    public async Task<IActionResult> Put(
        Guid companyId,
        [FromBody] UpdateCompanyFeaturesRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId && !c.IsDeleted, ct);

        if (company is null) return NotFound();
        if (req.Features is null) return BadRequest(new { error = "Body inválido." });

        foreach (var key in req.Features.Keys)
        {
            if (!PlanFeatureService.IsFeatureKeySupported(key))
                return BadRequest(new { error = $"Feature '{key}' não suportada." });
        }

        var normalized = req.Features
            .ToDictionary(k => k.Key.Trim().ToLowerInvariant(), v => v.Value, StringComparer.OrdinalIgnoreCase);

        var current = await _db.CompanyFeatureOverrides
            .Where(f => f.CompanyId == companyId)
            .ToListAsync(ct);

        foreach (var pair in normalized)
        {
            var existing = current.FirstOrDefault(x =>
                string.Equals(x.FeatureKey, pair.Key, StringComparison.OrdinalIgnoreCase));

            if (existing is null)
            {
                _db.CompanyFeatureOverrides.Add(new CompanyFeatureOverride
                {
                    CompanyId = companyId,
                    FeatureKey = pair.Key,
                    IsEnabled = pair.Value,
                    UpdatedAtUtc = DateTime.UtcNow
                });
                continue;
            }

            existing.IsEnabled = pair.Value;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var resolved = await _features.ResolveFeaturesAsync(company, ct);
        return Ok(new { companyId = company.Id, plan = company.Plan, features = resolved });
    }
}

public record UpdateCompanyFeaturesRequest(Dictionary<string, bool> Features);
