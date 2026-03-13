using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Pdv;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>CRUD de terminais PDV — gerenciado pelo admin/gerente.</summary>
[ApiController]
[Route("admin/cash-registers")]
[Authorize(Roles = "admin,gerente")]
public class CashRegisterController : ControllerBase
{
    private readonly AppDbContext _db;

    public CashRegisterController(AppDbContext db) => _db = db;

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/cash-registers ─────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var registers = await _db.CashRegisters
            .AsNoTracking()
            .Where(r => r.CompanyId == CompanyId)
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.FiscalSerie,
                r.FiscalAutoIssuePix,
                r.FiscalSendCashToSefaz,
                r.IsActive,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(registers);
    }

    // ── GET /admin/cash-registers/{id} ────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await _db.CashRegisters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);

        if (r is null) return NotFound("Terminal não encontrado.");

        return Ok(new
        {
            r.Id, r.Name, r.FiscalSerie,
            r.FiscalAutoIssuePix, r.FiscalSendCashToSefaz,
            r.IsActive, r.CreatedAtUtc, r.UpdatedAtUtc
        });
    }

    // ── POST /admin/cash-registers ────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateCashRegisterRequest req,
        CancellationToken ct)
    {
        var register = new CashRegister
        {
            CompanyId            = CompanyId,
            Name                 = req.Name,
            FiscalSerie          = req.FiscalSerie ?? "001",
            FiscalAutoIssuePix   = req.FiscalAutoIssuePix ?? true,
            FiscalSendCashToSefaz = req.FiscalSendCashToSefaz ?? false,
            IsActive             = true
        };

        _db.CashRegisters.Add(register);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = register.Id },
            new { register.Id, register.Name });
    }

    // ── PUT /admin/cash-registers/{id} ────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateCashRegisterRequest req,
        CancellationToken ct)
    {
        var r = await _db.CashRegisters
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);

        if (r is null) return NotFound("Terminal não encontrado.");

        if (req.Name         != null) r.Name                  = req.Name;
        if (req.FiscalSerie  != null) r.FiscalSerie            = req.FiscalSerie;
        if (req.FiscalAutoIssuePix.HasValue)
            r.FiscalAutoIssuePix = req.FiscalAutoIssuePix.Value;
        if (req.FiscalSendCashToSefaz.HasValue)
            r.FiscalSendCashToSefaz = req.FiscalSendCashToSefaz.Value;
        if (req.IsActive.HasValue)
            r.IsActive = req.IsActive.Value;

        r.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}

public record CreateCashRegisterRequest(
    [Required, MaxLength(80)] string Name,
    [MaxLength(3)] string? FiscalSerie = null,
    bool? FiscalAutoIssuePix = null,
    bool? FiscalSendCashToSefaz = null
);

public record UpdateCashRegisterRequest(
    string? Name,
    string? FiscalSerie,
    bool? FiscalAutoIssuePix,
    bool? FiscalSendCashToSefaz,
    bool? IsActive
);

// ── Admin: histórico de sessões ────────────────────────────────────────────────

[ApiController]
[Route("admin/pdv")]
[Authorize(Roles = "admin,gerente")]
public class PdvSessionAdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public PdvSessionAdminController(AppDbContext db) => _db = db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // GET /admin/pdv/sessions
    [HttpGet("sessions")]
    public async Task<IActionResult> ListSessions(
        [FromQuery] Guid?   registerId = null,
        [FromQuery] string? status     = null,
        [FromQuery] int     page       = 1,
        CancellationToken   ct         = default)
    {
        var q = _db.CashSessions.AsNoTracking()
            .Include(s => s.CashRegister)
            .Where(s => s.CompanyId == CompanyId);

        if (registerId.HasValue) q = q.Where(s => s.CashRegisterId == registerId.Value);
        if (status == "Open")   q = q.Where(s => s.Status == CashSessionStatus.Open);
        if (status == "Closed") q = q.Where(s => s.Status == CashSessionStatus.Closed);

        const int pageSize = 20;
        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(s => s.OpenedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new {
                s.Id,
                RegisterName             = s.CashRegister.Name,
                s.OpenedByUserName,
                s.ClosedByUserName,
                Status                   = s.Status.ToString(),
                s.OpeningBalanceCents,
                s.ClosingBalanceCents,
                s.TotalSalesCount,
                s.TotalSalesCents,
                s.PermanentContingencyCount,
                s.OpenedAtUtc,
                s.ClosedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }
}
