using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.StoreFront;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/tables")]
[Authorize(Roles = "admin,gerente,atendente")]
public class TablesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public TablesController(AppDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/tables ──────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tables = await _db.Tables
            .AsNoTracking()
            .Where(t => t.CompanyId == CompanyId)
            .OrderBy(t => t.Number)
            .Select(t => new
            {
                t.Id,
                t.Number,
                t.Name,
                t.Capacity,
                t.IsActive,
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(tables);
    }

    // ── GET /admin/tables/{id} ─────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);

        if (table is null) return NotFound();
        return Ok(table);
    }

    // ── POST /admin/tables ─────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> Create([FromBody] UpsertTableRequest req, CancellationToken ct)
    {
        if (req.Number <= 0)
            return BadRequest("Número da mesa deve ser maior que zero.");

        var exists = await _db.Tables.AnyAsync(
            t => t.CompanyId == CompanyId && t.Number == req.Number, ct);
        if (exists)
            return Conflict($"Mesa {req.Number} já existe.");

        var table = new Table
        {
            CompanyId = CompanyId,
            Number    = req.Number,
            Name      = req.Name?.Trim(),
            Capacity  = req.Capacity > 0 ? req.Capacity : 4,
            IsActive  = true,
        };

        _db.Tables.Add(table);
        await _db.SaveChangesAsync(ct);

        return Ok(MapTable(table, GetCatalogBaseUrl()));
    }

    // ── PUT /admin/tables/{id} ────────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertTableRequest req, CancellationToken ct)
    {
        var table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);

        if (table is null) return NotFound();

        if (req.Number > 0 && req.Number != table.Number)
        {
            var exists = await _db.Tables.AnyAsync(
                t => t.CompanyId == CompanyId && t.Number == req.Number && t.Id != id, ct);
            if (exists) return Conflict($"Mesa {req.Number} já existe.");
            table.Number = req.Number;
        }

        if (req.Name is not null) table.Name     = req.Name.Trim();
        if (req.Capacity > 0)     table.Capacity = req.Capacity;
        if (req.IsActive.HasValue) table.IsActive = req.IsActive.Value;

        table.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(MapTable(table, GetCatalogBaseUrl()));
    }

    // ── DELETE /admin/tables/{id} ─────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);

        if (table is null) return NotFound();

        _db.Tables.Remove(table);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── GET /admin/tables/{id}/metrics ────────────────────────────────────────
    [HttpGet("{id:guid}/metrics")]
    public async Task<IActionResult> Metrics(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);

        if (table is null) return NotFound();

        var orders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.TableId == id &&
                        o.Status != OrderStatus.CANCELADO)
            .Select(o => new { o.TotalCents, o.Status, o.CreatedAtUtc })
            .ToListAsync(ct);

        var completed = orders.Where(o => o.Status == OrderStatus.ENTREGUE).ToList();

        return Ok(new
        {
            tableId       = id,
            tableNumber   = table.Number,
            tableName     = table.Name,
            totalOrders   = orders.Count,
            completedOrders = completed.Count,
            avgTicketCents = completed.Count > 0
                ? (int)completed.Average(o => o.TotalCents) : 0,
            totalRevenueCents = completed.Sum(o => o.TotalCents),
            lastOrderUtc  = orders.Count > 0
                ? orders.Max(o => o.CreatedAtUtc) : (DateTime?)null,
        });
    }

    // ── GET /admin/tables/overview ────────────────────────────────────────────
    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct)
    {
        var companyId = CompanyId;
        var baseUrl   = GetCatalogBaseUrl();

        var tables = await _db.Tables
            .AsNoTracking()
            .Where(t => t.CompanyId == companyId)
            .OrderBy(t => t.Number)
            .ToListAsync(ct);

        // Pedidos abertos (não cancelados, não entregues) por mesa
        var openOrders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId &&
                        o.TableId != null &&
                        o.Status != OrderStatus.CANCELADO &&
                        o.Status != OrderStatus.ENTREGUE)
            .GroupBy(o => o.TableId!.Value)
            .Select(g => new { TableId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var openByTable = openOrders.ToDictionary(x => x.TableId, x => x.Count);

        var result = tables.Select(t => new
        {
            t.Id,
            t.Number,
            t.Name,
            t.Capacity,
            t.IsActive,
            openOrders    = openByTable.GetValueOrDefault(t.Id, 0),
            qrUrl         = $"{baseUrl}/mesa/{t.Id}",
        });

        return Ok(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private string GetCatalogBaseUrl()
    {
        // Em produção, usa o slug da empresa no domínio.
        // Fallback para a base URL configurada.
        return _config["App:CatalogBaseUrl"] ?? "https://vendapps.com.br";
    }

    private static object MapTable(Table t, string baseUrl) => new
    {
        t.Id,
        t.Number,
        t.Name,
        t.Capacity,
        t.IsActive,
        t.CreatedAtUtc,
        t.UpdatedAtUtc,
        qrUrl = $"{baseUrl}/mesa/{t.Id}",
    };
}

public record UpsertTableRequest(int Number, string? Name, int Capacity, bool? IsActive);
