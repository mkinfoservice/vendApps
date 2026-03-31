using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Dav;
using Petshop.Api.Entities.StoreFront;
using Petshop.Api.Services.Dav;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/tables")]
[Authorize(Roles = "admin,gerente,atendente")]
public class TablesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private static readonly OrderStatus[] ActiveTableOrderStatuses =
    [
        OrderStatus.RECEBIDO,
        OrderStatus.EM_PREPARO,
        OrderStatus.PRONTO_PARA_ENTREGA,
        OrderStatus.SAIU_PARA_ENTREGA,
    ];

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

        return Ok(MapTable(table, await GetCatalogBaseUrlAsync(ct)));
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

        return Ok(MapTable(table, await GetCatalogBaseUrlAsync(ct)));
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
        var baseUrl   = await GetCatalogBaseUrlAsync(ct);

        var tables = await _db.Tables
            .AsNoTracking()
            .Where(t => t.CompanyId == companyId)
            .OrderBy(t => t.Number)
            .ToListAsync(ct);

        // Pedidos abertos (não cancelados, não entregues) por mesa
        var openOrders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId &&
                        o.IsTableOrder &&
                        o.TableId != null &&
                        ActiveTableOrderStatuses.Contains(o.Status))
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

    // ── GET /admin/tables/{id}/service ───────────────────────────────────────
    [HttpGet("{id:guid}/service")]
    public async Task<IActionResult> Service(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (table is null) return NotFound();

        var orders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId &&
                        o.IsTableOrder &&
                        o.TableId == id &&
                        o.Status != OrderStatus.CANCELADO &&
                        o.Status != OrderStatus.ENTREGUE)
            .OrderBy(o => o.CreatedAtUtc)
            .Select(o => new
            {
                o.Id,
                o.PublicId,
                o.CustomerName,
                status = o.Status.ToString(),
                o.TotalCents,
                o.CreatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(new
        {
            table = new
            {
                table.Id,
                table.Number,
                table.Name,
                table.Capacity,
                table.IsActive,
            },
            activeOrders = orders,
            totals = new
            {
                orders = orders.Count,
                amountCents = orders.Sum(o => o.TotalCents),
            }
        });
    }

    // ── POST /admin/tables/{id}/finalize ─────────────────────────────────────
    [HttpPost("{id:guid}/finalize")]
    public async Task<IActionResult> FinalizeTable(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (table is null) return NotFound();

        var activeOrders = await _db.Orders
            .Where(o => o.CompanyId == CompanyId &&
                        o.IsTableOrder &&
                        o.TableId == id &&
                        o.Status != OrderStatus.CANCELADO &&
                        o.Status != OrderStatus.ENTREGUE)
            .ToListAsync(ct);

        if (activeOrders.Count == 0)
        {
            return Ok(new
            {
                finalized = 0,
                pending = 0,
                message = "Mesa já está livre."
            });
        }

        var pending = activeOrders
            .Where(o => o.Status == OrderStatus.RECEBIDO || o.Status == OrderStatus.EM_PREPARO)
            .ToList();

        if (pending.Count > 0)
        {
            return Conflict(new
            {
                error = "Ainda existem pedidos em preparo/recebidos. Só é possível finalizar mesa quando estiver PRONTO_PARA_ENTREGA.",
                pendingOrders = pending.Select(o => o.PublicId).ToList(),
            });
        }

        var toFinalize = activeOrders
            .Where(o => o.Status == OrderStatus.PRONTO_PARA_ENTREGA || o.Status == OrderStatus.SAIU_PARA_ENTREGA)
            .ToList();

        var now = DateTime.UtcNow;
        foreach (var order in toFinalize)
        {
            order.Status = OrderStatus.ENTREGUE;
            order.UpdatedAtUtc = now;
        }

        // Gera DAV consolidado para o caixa importar e cobrar
        var allOrderIds = toFinalize.Select(o => o.Id).ToList();
        var allItems = await _db.OrderItems
            .AsNoTracking()
            .Where(i => allOrderIds.Contains(i.OrderId))
            .ToListAsync(ct);

        string? davPublicId = null;
        if (allItems.Count > 0)
        {
            var firstOrder = toFinalize[0];
            var subtotal = allItems.Sum(i => i.UnitPriceCentsSnapshot * i.Qty);

            var dav = new SalesQuote
            {
                CompanyId    = CompanyId,
                PublicId     = DavPublicIdGenerator.NewPublicId(),
                Origin       = SalesQuoteOrigin.TableOrder,
                CustomerName = firstOrder.CustomerName ?? $"Mesa {table.Number}",
                CustomerPhone = firstOrder.Phone,
                PaymentMethod = "PAY_AT_COUNTER",
                SubtotalCents = subtotal,
                TotalCents    = subtotal,
                Notes         = $"Mesa {table.Number}{(table.Name is not null ? $" · {table.Name}" : "")} — {toFinalize.Count} pedido{(toFinalize.Count > 1 ? "s" : "")}",
                Items = allItems.Select(i => new SalesQuoteItem
                {
                    ProductId               = i.ProductId,
                    ProductNameSnapshot     = i.ProductNameSnapshot,
                    Qty                     = i.Qty,
                    UnitPriceCentsSnapshot  = i.UnitPriceCentsSnapshot,
                    TotalCents              = i.UnitPriceCentsSnapshot * i.Qty,
                }).ToList(),
            };

            _db.SalesQuotes.Add(dav);
            davPublicId = dav.PublicId;
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            finalized = toFinalize.Count,
            pending = 0,
            davPublicId,
            message = davPublicId is not null
                ? $"Mesa finalizada. DAV {davPublicId} gerado para o caixa."
                : "Mesa finalizada e liberada para reuso.",
        });
    }

    // ── POST /admin/tables/{id}/cancel-open ──────────────────────────────────
    [HttpPost("{id:guid}/cancel-open")]
    public async Task<IActionResult> CancelOpen(Guid id, CancellationToken ct)
    {
        var table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (table is null) return NotFound();

        var openOrders = await _db.Orders
            .Where(o => o.CompanyId == CompanyId &&
                        o.IsTableOrder &&
                        o.TableId == id &&
                        o.Status != OrderStatus.CANCELADO &&
                        o.Status != OrderStatus.ENTREGUE)
            .ToListAsync(ct);

        if (openOrders.Count == 0)
        {
            return Ok(new
            {
                cancelled = 0,
                message = "Nenhuma comanda aberta para cancelar."
            });
        }

        var now = DateTime.UtcNow;
        foreach (var order in openOrders)
        {
            order.Status = OrderStatus.CANCELADO;
            order.UpdatedAtUtc = now;
        }
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            cancelled = openOrders.Count,
            message = "Comanda cancelada com sucesso."
        });
    }

    // ── GET /public/tables/{tableId} (sem auth) ───────────────────────────────
    [AllowAnonymous]
    [HttpGet("/public/tables/{tableId:guid}")]
    public async Task<IActionResult> PublicTableInfo(Guid tableId, CancellationToken ct)
    {
        var result = await _db.Tables
            .AsNoTracking()
            .Where(t => t.Id == tableId && t.IsActive)
            .Join(_db.Companies.AsNoTracking(),
                t => t.CompanyId,
                c => c.Id,
                (t, c) => new { t.Number, t.Name, t.Capacity, c.Slug })
            .FirstOrDefaultAsync(ct);

        if (result is null) return NotFound();
        return Ok(new { result.Slug, result.Number, result.Name, result.Capacity });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> GetCatalogBaseUrlAsync(CancellationToken ct)
    {
        var baseDomain = _config["App:BaseDomain"] ?? "vendapps.com.br";
        var slug = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == CompanyId)
            .Select(c => c.Slug)
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrEmpty(slug))
            return $"https://{slug}.{baseDomain}";

        return _config["App:CatalogBaseUrl"] ?? $"https://{baseDomain}";
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
