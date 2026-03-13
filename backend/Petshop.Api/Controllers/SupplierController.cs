using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Purchases;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/suppliers")]
[Authorize(Roles = "admin,gerente")]
public class SupplierController : ControllerBase
{
    private readonly AppDbContext _db;
    public SupplierController(AppDbContext db) => _db = db;

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/suppliers ──────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool includeInactive = false,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var q = _db.Suppliers.AsNoTracking()
            .Where(s => s.CompanyId == CompanyId);

        if (!includeInactive) q = q.Where(s => s.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(s => s.Name.Contains(search) || (s.Cnpj != null && s.Cnpj.Contains(search)));

        var items = await q
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(s.Id, s.Name, s.Cnpj, s.Email, s.Phone,
                                         s.ContactName, s.Notes, s.IsActive, s.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(items);
    }

    // ── POST /admin/suppliers ─────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertSupplierRequest req, CancellationToken ct)
    {
        var supplier = new Supplier
        {
            CompanyId   = CompanyId,
            Name        = req.Name.Trim(),
            Cnpj        = req.Cnpj?.Trim(),
            Email       = req.Email?.Trim(),
            Phone       = req.Phone?.Trim(),
            ContactName = req.ContactName?.Trim(),
            Notes       = req.Notes,
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = supplier.Id },
            ToDto(supplier));
    }

    // ── GET /admin/suppliers/{id} ─────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var s = await _db.Suppliers.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        return s is null ? NotFound() : Ok(ToDto(s));
    }

    // ── PUT /admin/suppliers/{id} ─────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertSupplierRequest req, CancellationToken ct)
    {
        var s = await _db.Suppliers
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (s is null) return NotFound();

        s.Name        = req.Name.Trim();
        s.Cnpj        = req.Cnpj?.Trim();
        s.Email       = req.Email?.Trim();
        s.Phone       = req.Phone?.Trim();
        s.ContactName = req.ContactName?.Trim();
        s.Notes       = req.Notes;
        s.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ToDto(s));
    }

    // ── DELETE /admin/suppliers/{id} (soft) ───────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        var s = await _db.Suppliers
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (s is null) return NotFound();

        s.IsActive     = false;
        s.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static SupplierDto ToDto(Supplier s) =>
        new(s.Id, s.Name, s.Cnpj, s.Email, s.Phone, s.ContactName, s.Notes, s.IsActive, s.CreatedAtUtc);
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record SupplierDto(
    Guid     Id,
    string   Name,
    string?  Cnpj,
    string?  Email,
    string?  Phone,
    string?  ContactName,
    string?  Notes,
    bool     IsActive,
    DateTime CreatedAtUtc
);

public record UpsertSupplierRequest(
    [Required, MaxLength(120)] string Name,
    string? Cnpj        = null,
    string? Email       = null,
    string? Phone       = null,
    string? ContactName = null,
    string? Notes       = null
);
