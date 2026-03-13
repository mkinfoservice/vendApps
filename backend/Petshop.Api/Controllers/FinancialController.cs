using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Financial;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/financial")]
[Authorize(Roles = "admin,gerente")]
public class FinancialController : ControllerBase
{
    private readonly AppDbContext _db;
    public FinancialController(AppDbContext db) => _db = db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/financial/entries ──────────────────────────────────────────
    [HttpGet("entries")]
    public async Task<IActionResult> ListEntries(
        [FromQuery] string? type     = null,   // "Receita" | "Despesa"
        [FromQuery] string? status   = null,   // "paid" | "pending" | "overdue"
        [FromQuery] string? category = null,
        [FromQuery] string? from     = null,   // ISO date YYYY-MM-DD
        [FromQuery] string? to       = null,
        [FromQuery] int     page     = 1,
        CancellationToken   ct       = default)
    {
        var q = _db.FinancialEntries.AsNoTracking()
            .Where(e => e.CompanyId == CompanyId);

        if (type is not null && Enum.TryParse<FinancialEntryType>(type, out var t))
            q = q.Where(e => e.Type == t);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (status == "paid")    q = q.Where(e => e.IsPaid);
        if (status == "pending") q = q.Where(e => !e.IsPaid && e.DueDate >= today);
        if (status == "overdue") q = q.Where(e => !e.IsPaid && e.DueDate < today);

        if (category is not null) q = q.Where(e => e.Category == category);

        if (DateOnly.TryParse(from, out var fromDate)) q = q.Where(e => e.DueDate >= fromDate);
        if (DateOnly.TryParse(to,   out var toDate))   q = q.Where(e => e.DueDate <= toDate);

        const int pageSize = 25;
        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(e => e.IsPaid)                // pendentes primeiro
            .ThenBy(e => e.DueDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => ToDto(e, today))
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // ── GET /admin/financial/summary ─────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(
        [FromQuery] string? from = null,
        [FromQuery] string? to   = null,
        CancellationToken   ct   = default)
    {
        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDate = DateOnly.TryParse(from, out var fd) ? fd : today.AddDays(-30);
        var toDate   = DateOnly.TryParse(to,   out var td) ? td : today;

        var entries = await _db.FinancialEntries.AsNoTracking()
            .Where(e => e.CompanyId == CompanyId &&
                        e.DueDate >= fromDate && e.DueDate <= toDate)
            .ToListAsync(ct);

        var paidReceitas  = entries.Where(e => e.Type == FinancialEntryType.Receita && e.IsPaid).Sum(e => e.AmountCents);
        var paidDespesas  = entries.Where(e => e.Type == FinancialEntryType.Despesa && e.IsPaid).Sum(e => e.AmountCents);
        var pendReceitas  = entries.Where(e => e.Type == FinancialEntryType.Receita && !e.IsPaid).Sum(e => e.AmountCents);
        var pendDespesas  = entries.Where(e => e.Type == FinancialEntryType.Despesa && !e.IsPaid).Sum(e => e.AmountCents);
        var overdueCount  = entries.Count(e => !e.IsPaid && e.DueDate < today);

        var byCategory = entries
            .GroupBy(e => e.Category ?? "(sem categoria)")
            .Select(g => new
            {
                Category    = g.Key,
                Receitas    = g.Where(e => e.Type == FinancialEntryType.Receita).Sum(e => e.AmountCents),
                Despesas    = g.Where(e => e.Type == FinancialEntryType.Despesa).Sum(e => e.AmountCents),
            })
            .OrderByDescending(x => x.Receitas + x.Despesas)
            .ToList();

        return Ok(new
        {
            From            = fromDate,
            To              = toDate,
            PaidReceitasCents  = paidReceitas,
            PaidDespesasCents  = paidDespesas,
            NetPaidCents       = paidReceitas - paidDespesas,
            PendReceitasCents  = pendReceitas,
            PendDespesasCents  = pendDespesas,
            NetPendingCents    = pendReceitas - pendDespesas,
            OverdueCount       = overdueCount,
            ByCategory         = byCategory,
        });
    }

    // ── GET /admin/financial/categories ──────────────────────────────────────
    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct)
    {
        var cats = await _db.FinancialEntries.AsNoTracking()
            .Where(e => e.CompanyId == CompanyId && e.Category != null)
            .Select(e => e.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
        return Ok(cats);
    }

    // ── POST /admin/financial/entries ─────────────────────────────────────────
    [HttpPost("entries")]
    public async Task<IActionResult> Create([FromBody] UpsertEntryRequest req, CancellationToken ct)
    {
        if (!Enum.TryParse<FinancialEntryType>(req.Type, out var type))
            return BadRequest("Tipo inválido. Use 'Receita' ou 'Despesa'.");
        if (!DateOnly.TryParse(req.DueDate, out var dueDate))
            return BadRequest("DueDate inválido.");

        var entry = new FinancialEntry
        {
            CompanyId    = CompanyId,
            Type         = type,
            Title        = req.Title.Trim(),
            AmountCents  = req.AmountCents,
            DueDate      = dueDate,
            Category     = req.Category?.Trim(),
            Notes        = req.Notes?.Trim(),
        };

        _db.FinancialEntries.Add(entry);
        await _db.SaveChangesAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return CreatedAtAction(nameof(ListEntries), null, ToDto(entry, today));
    }

    // ── PUT /admin/financial/entries/{id} ─────────────────────────────────────
    [HttpPut("entries/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertEntryRequest req, CancellationToken ct)
    {
        var entry = await _db.FinancialEntries
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == CompanyId, ct);
        if (entry is null) return NotFound();

        if (!Enum.TryParse<FinancialEntryType>(req.Type, out var type))
            return BadRequest("Tipo inválido.");
        if (!DateOnly.TryParse(req.DueDate, out var dueDate))
            return BadRequest("DueDate inválido.");

        entry.Type         = type;
        entry.Title        = req.Title.Trim();
        entry.AmountCents  = req.AmountCents;
        entry.DueDate      = dueDate;
        entry.Category     = req.Category?.Trim();
        entry.Notes        = req.Notes?.Trim();
        entry.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(ToDto(entry, today));
    }

    // ── PATCH /admin/financial/entries/{id}/pay ───────────────────────────────
    [HttpPatch("entries/{id:guid}/pay")]
    public async Task<IActionResult> Pay(
        Guid id,
        [FromBody] PayEntryRequest req,
        CancellationToken ct)
    {
        var entry = await _db.FinancialEntries
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == CompanyId, ct);
        if (entry is null) return NotFound();

        var paidDate = req.PaidDate is not null && DateOnly.TryParse(req.PaidDate, out var pd)
            ? pd : DateOnly.FromDateTime(DateTime.UtcNow);

        entry.IsPaid       = true;
        entry.PaidDate     = paidDate;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(ToDto(entry, today));
    }

    // ── PATCH /admin/financial/entries/{id}/unpay ─────────────────────────────
    [HttpPatch("entries/{id:guid}/unpay")]
    public async Task<IActionResult> Unpay(Guid id, CancellationToken ct)
    {
        var entry = await _db.FinancialEntries
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == CompanyId, ct);
        if (entry is null) return NotFound();

        entry.IsPaid       = false;
        entry.PaidDate     = null;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(ToDto(entry, today));
    }

    // ── DELETE /admin/financial/entries/{id} ──────────────────────────────────
    [HttpDelete("entries/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entry = await _db.FinancialEntries
            .FirstOrDefaultAsync(e => e.Id == id && e.CompanyId == CompanyId, ct);
        if (entry is null) return NotFound();

        _db.FinancialEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static object ToDto(FinancialEntry e, DateOnly today) => new
    {
        e.Id,
        Type         = e.Type.ToString(),
        e.Title,
        e.AmountCents,
        DueDate      = e.DueDate.ToString("yyyy-MM-dd"),
        PaidDate     = e.PaidDate?.ToString("yyyy-MM-dd"),
        e.IsPaid,
        e.Category,
        e.Notes,
        e.ReferenceType,
        e.ReferenceId,
        e.CreatedAtUtc,
        Status       = e.IsPaid ? "paid"
                     : e.DueDate < today ? "overdue"
                     : "pending",
    };
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record UpsertEntryRequest(
    [Required] string Type,         // "Receita" | "Despesa"
    [Required, MaxLength(200)] string Title,
    int     AmountCents,
    [Required] string DueDate,      // "YYYY-MM-DD"
    string? Category = null,
    string? Notes    = null
);

public record PayEntryRequest(string? PaidDate = null);  // "YYYY-MM-DD" ou null = hoje
