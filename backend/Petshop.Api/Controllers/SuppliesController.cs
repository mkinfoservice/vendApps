using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Services.WhatsApp;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/supplies")]
[Authorize(Roles = "admin,gerente")]
public class SuppliesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly WhatsAppClient _whatsAppClient;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    public SuppliesController(AppDbContext db, WhatsAppClient whatsAppClient)
    {
        _db = db;
        _whatsAppClient = whatsAppClient;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? active,
        [FromQuery] bool? lowStock,
        CancellationToken ct)
    {
        var q = _db.Supplies.Where(s => s.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(s => s.Name.ToLower().Contains(search.ToLower()));

        if (active.HasValue)
            q = q.Where(s => s.IsActive == active.Value);

        if (lowStock == true)
            q = q.Where(s => s.StockQty <= s.MinQty);

        var items = await q
            .OrderBy(s => s.Name)
            .Select(s => new SupplyDto(s.Id, s.Name, s.Unit, s.Category, s.StockQty, s.MinQty,
                s.SupplierName, s.Notes, s.IsActive, s.CreatedAtUtc, s.UpdatedAtUtc,
                s.StockQty <= s.MinQty))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var s = await _db.Supplies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (s is null) return NotFound();
        return Ok(ToDto(s));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertSupplyRequest req, CancellationToken ct)
    {
        var supply = new Supply
        {
            CompanyId    = CompanyId,
            Name         = req.Name.Trim(),
            Unit         = req.Unit?.Trim() ?? "UN",
            Category     = req.Category?.Trim(),
            StockQty     = req.StockQty,
            MinQty       = req.MinQty,
            SupplierName = req.SupplierName?.Trim(),
            Notes        = req.Notes?.Trim(),
            IsActive     = req.IsActive ?? true,
        };
        _db.Supplies.Add(supply);
        await _db.SaveChangesAsync(ct);
        await EnsureLowStockAlertAsync(supply, ct);
        return CreatedAtAction(nameof(Get), new { id = supply.Id }, ToDto(supply));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertSupplyRequest req, CancellationToken ct)
    {
        var supply = await _db.Supplies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (supply is null) return NotFound();

        supply.Name         = req.Name.Trim();
        supply.Unit         = req.Unit?.Trim() ?? supply.Unit;
        supply.Category     = req.Category?.Trim();
        supply.StockQty     = req.StockQty;
        supply.MinQty       = req.MinQty;
        supply.SupplierName = req.SupplierName?.Trim();
        supply.Notes        = req.Notes?.Trim();
        supply.IsActive     = req.IsActive ?? supply.IsActive;
        supply.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        await EnsureLowStockAlertAsync(supply, ct);
        return Ok(ToDto(supply));
    }

    [HttpPatch("{id:guid}/stock")]
    public async Task<IActionResult> UpdateStock(Guid id, [FromBody] UpdateStockRequest req, CancellationToken ct)
    {
        var supply = await _db.Supplies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (supply is null) return NotFound();

        supply.StockQty     = req.StockQty;
        supply.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await EnsureLowStockAlertAsync(supply, ct);

        return Ok(ToDto(supply));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var supply = await _db.Supplies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (supply is null) return NotFound();
        _db.Supplies.Remove(supply);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Alertas ───────────────────────────────────────────────────────────────

    [HttpGet("alerts")]
    public async Task<IActionResult> GetAlerts(CancellationToken ct)
    {
        var alerts = await _db.AdminAlerts
            .Where(a => a.CompanyId == CompanyId && !a.IsRead)
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new AlertDto(a.Id, a.AlertType, a.Title, a.Message, a.ReferenceId, a.CreatedAtUtc))
            .ToListAsync(ct);
        return Ok(alerts);
    }

    [HttpPost("alerts/{alertId:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid alertId, CancellationToken ct)
    {
        var alert = await _db.AdminAlerts
            .FirstOrDefaultAsync(a => a.Id == alertId && a.CompanyId == CompanyId, ct);
        if (alert is null) return NotFound();
        alert.IsRead    = true;
        alert.ReadAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("alerts/read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await _db.AdminAlerts
            .Where(a => a.CompanyId == CompanyId && !a.IsRead)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsRead, true)
                .SetProperty(a => a.ReadAtUtc, DateTime.UtcNow), ct);
        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task EnsureLowStockAlertAsync(Supply supply, CancellationToken ct)
    {
        if (supply.MinQty <= 0 || supply.StockQty > supply.MinQty) return;
        await CreateLowStockAlertAsync(supply, ct);
    }

    private async Task CreateLowStockAlertAsync(Supply supply, CancellationToken ct)
    {
        // Evita duplicar alerta não lido para o mesmo insumo
        var exists = await _db.AdminAlerts.AnyAsync(a =>
            a.CompanyId == CompanyId &&
            a.AlertType == "supply_low" &&
            a.ReferenceId == supply.Id &&
            !a.IsRead, ct);

        if (exists) return;

        _db.AdminAlerts.Add(new Petshop.Api.Entities.Master.AdminAlert
        {
            CompanyId   = CompanyId,
            AlertType   = "supply_low",
            Title       = $"Insumo baixo: {supply.Name}",
            Message     = $"O insumo \"{supply.Name}\" está com estoque baixo: {supply.StockQty} {supply.Unit} (mínimo: {supply.MinQty} {supply.Unit}). Recomendamos reabastecer.",
            ReferenceId = supply.Id,
        });
        await _db.SaveChangesAsync(ct);

        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == CompanyId, ct);
        var ownerPhone = WhatsAppClient.NormalizeToE164Brazil(company?.OwnerAlertPhone);
        if (ownerPhone is null) return;

        var text = $"[Alerta de insumo] {supply.Name} está em {supply.StockQty} {supply.Unit} (mínimo {supply.MinQty} {supply.Unit}). Reabastecimento recomendado.";
        await _whatsAppClient.SendTextAsync(ownerPhone, text, CompanyId, ct);
    }

    private static SupplyDto ToDto(Supply s) =>
        new(s.Id, s.Name, s.Unit, s.Category, s.StockQty, s.MinQty,
            s.SupplierName, s.Notes, s.IsActive, s.CreatedAtUtc, s.UpdatedAtUtc,
            s.StockQty <= s.MinQty);
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record SupplyDto(
    Guid     Id,
    string   Name,
    string   Unit,
    string?  Category,
    decimal  StockQty,
    decimal  MinQty,
    string?  SupplierName,
    string?  Notes,
    bool     IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    bool     IsLow
);

public record UpsertSupplyRequest(
    string  Name,
    string? Unit,
    string? Category,
    decimal StockQty,
    decimal MinQty,
    string? SupplierName,
    string? Notes,
    bool?   IsActive
);

public record UpdateStockRequest(decimal StockQty);

public record AlertDto(
    Guid     Id,
    string   AlertType,
    string   Title,
    string   Message,
    Guid?    ReferenceId,
    DateTime CreatedAtUtc
);
