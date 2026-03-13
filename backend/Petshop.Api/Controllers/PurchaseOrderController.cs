using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Purchases;
using Petshop.Api.Services.Purchases;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/purchases")]
[Authorize(Roles = "admin,gerente")]
public class PurchaseOrderController : ControllerBase
{
    private readonly AppDbContext              _db;
    private readonly PurchaseReceivingService  _receiving;

    public PurchaseOrderController(AppDbContext db, PurchaseReceivingService receiving)
    {
        _db        = db;
        _receiving = receiving;
    }

    private Guid   CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);
    private string UserName  => User.FindFirstValue(ClaimTypes.Name) ?? "Admin";

    // ── GET /admin/purchases ──────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status = null,
        [FromQuery] Guid?   supplierId = null,
        [FromQuery] int     page = 1,
        [FromQuery] int     pageSize = 30,
        CancellationToken   ct = default)
    {
        var q = _db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Supplier)
            .Where(p => p.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<PurchaseOrderStatus>(status, true, out var s))
            q = q.Where(p => p.Status == s);

        if (supplierId.HasValue)
            q = q.Where(p => p.SupplierId == supplierId.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PurchaseOrderListItem(
                p.Id, p.Supplier!.Name, p.Status.ToString(),
                p.InvoiceNumber, p.TotalCents,
                p.Items.Count,
                p.OrderedAtUtc, p.ReceivedAtUtc, p.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // ── GET /admin/purchases/{id} ─────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();

        return Ok(MapDetail(po));
    }

    // ── POST /admin/purchases ─────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderRequest req, CancellationToken ct)
    {
        var supplier = await _db.Suppliers
            .FirstOrDefaultAsync(s => s.Id == req.SupplierId && s.CompanyId == CompanyId, ct);
        if (supplier is null) return BadRequest("Fornecedor não encontrado.");

        var po = new PurchaseOrder
        {
            CompanyId     = CompanyId,
            SupplierId    = req.SupplierId,
            InvoiceNumber = req.InvoiceNumber,
            Notes         = req.Notes,
            OrderedAtUtc  = req.OrderedAtUtc ?? DateTime.UtcNow,
        };

        foreach (var item in req.Items ?? [])
        {
            var product = await _db.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.CompanyId == CompanyId, ct);
            if (product is null) continue;

            po.Items.Add(new PurchaseOrderItem
            {
                ProductId            = product.Id,
                ProductNameSnapshot  = product.Name,
                ProductBarcodeSnapshot = product.Barcode,
                Qty                  = item.Qty,
                UnitCostCents        = item.UnitCostCents,
                TotalCents           = (int)(item.Qty * item.UnitCostCents),
            });
        }

        po.TotalCents = po.Items.Sum(i => i.TotalCents);

        _db.PurchaseOrders.Add(po);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = po.Id },
            new { po.Id, po.Status });
    }

    // ── PUT /admin/purchases/{id} ─────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePurchaseOrderRequest req, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();
        if (po.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Apenas ordens em rascunho podem ser editadas.");

        po.InvoiceNumber = req.InvoiceNumber;
        po.Notes         = req.Notes;
        po.OrderedAtUtc  = req.OrderedAtUtc;
        po.UpdatedAtUtc  = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { po.Id });
    }

    // ── POST /admin/purchases/{id}/items ──────────────────────────────────────
    [HttpPost("{id:guid}/items")]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] PurchaseItemRequest req, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();
        if (po.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Apenas ordens em rascunho podem ser alteradas.");

        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == req.ProductId && p.CompanyId == CompanyId, ct);
        if (product is null) return BadRequest("Produto não encontrado.");

        // Merge se produto já existe na ordem
        var existing = po.Items.FirstOrDefault(i => i.ProductId == req.ProductId);
        if (existing is not null)
        {
            existing.Qty           = req.Qty;
            existing.UnitCostCents = req.UnitCostCents;
            existing.TotalCents    = (int)(req.Qty * req.UnitCostCents);
        }
        else
        {
            po.Items.Add(new PurchaseOrderItem
            {
                ProductId              = product.Id,
                ProductNameSnapshot    = product.Name,
                ProductBarcodeSnapshot = product.Barcode,
                Qty                    = req.Qty,
                UnitCostCents          = req.UnitCostCents,
                TotalCents             = (int)(req.Qty * req.UnitCostCents),
            });
        }

        po.TotalCents   = po.Items.Sum(i => i.TotalCents);
        po.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { po.Id, po.TotalCents, itemCount = po.Items.Count });
    }

    // ── DELETE /admin/purchases/{id}/items/{itemId} ───────────────────────────
    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();
        if (po.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Apenas ordens em rascunho podem ser alteradas.");

        var item = po.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return NotFound();

        po.Items.Remove(item);
        _db.PurchaseOrderItems.Remove(item);
        po.TotalCents   = po.Items.Sum(i => i.TotalCents);
        po.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── POST /admin/purchases/{id}/confirm ────────────────────────────────────
    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();
        if (po.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Somente rascunhos podem ser confirmados.");

        po.Status       = PurchaseOrderStatus.Confirmed;
        po.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { po.Id, Status = po.Status.ToString() });
    }

    // ── POST /admin/purchases/{id}/receive ────────────────────────────────────
    [HttpPost("{id:guid}/receive")]
    public async Task<IActionResult> Receive(Guid id, CancellationToken ct)
    {
        try
        {
            await _receiving.ReceiveAsync(id, CompanyId, UserName, ct);
            return Ok(new { Id = id, Status = PurchaseOrderStatus.Received.ToString() });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // ── POST /admin/purchases/{id}/cancel ─────────────────────────────────────
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (po is null) return NotFound();
        if (po.Status == PurchaseOrderStatus.Received)
            return BadRequest("Ordens já recebidas não podem ser canceladas.");

        po.Status       = PurchaseOrderStatus.Cancelled;
        po.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { po.Id, Status = po.Status.ToString() });
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private static PurchaseOrderDetail MapDetail(PurchaseOrder po) => new(
        po.Id,
        po.SupplierId,
        po.Supplier?.Name ?? "",
        po.Status.ToString(),
        po.InvoiceNumber,
        po.Notes,
        po.TotalCents,
        po.OrderedAtUtc,
        po.ReceivedAtUtc,
        po.CreatedAtUtc,
        po.Items.Select(i => new PurchaseItemDto(
            i.Id, i.ProductId, i.ProductNameSnapshot,
            i.ProductBarcodeSnapshot, i.Qty, i.UnitCostCents, i.TotalCents
        )).ToList()
    );
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record PurchaseOrderListItem(
    Guid      Id,
    string    SupplierName,
    string    Status,
    string?   InvoiceNumber,
    int       TotalCents,
    int       ItemCount,
    DateTime? OrderedAtUtc,
    DateTime? ReceivedAtUtc,
    DateTime  CreatedAtUtc
);

public record PurchaseOrderDetail(
    Guid      Id,
    Guid      SupplierId,
    string    SupplierName,
    string    Status,
    string?   InvoiceNumber,
    string?   Notes,
    int       TotalCents,
    DateTime? OrderedAtUtc,
    DateTime? ReceivedAtUtc,
    DateTime  CreatedAtUtc,
    List<PurchaseItemDto> Items
);

public record PurchaseItemDto(
    Guid     Id,
    Guid     ProductId,
    string   ProductName,
    string?  Barcode,
    decimal  Qty,
    int      UnitCostCents,
    int      TotalCents
);

public record CreatePurchaseOrderRequest(
    Guid              SupplierId,
    string?           InvoiceNumber = null,
    string?           Notes         = null,
    DateTime?         OrderedAtUtc  = null,
    List<PurchaseItemRequest>? Items = null
);

public record UpdatePurchaseOrderRequest(
    string?   InvoiceNumber,
    string?   Notes,
    DateTime? OrderedAtUtc
);

public record PurchaseItemRequest(
    [Required] Guid    ProductId,
    [Range(0.001, double.MaxValue)] decimal Qty,
    [Range(0, int.MaxValue)] int UnitCostCents
);
