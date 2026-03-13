using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Stock;
using Petshop.Api.Services.Stock;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Gerenciamento de estoque por empresa.
/// Exposições: listagem com alertas, histórico de movimentos, ajuste manual.
/// </summary>
[ApiController]
[Route("admin/stock")]
[Authorize(Roles = "admin,gerente")]
public class StockController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly StockService _stock;

    public StockController(AppDbContext db, StockService stock)
    {
        _db    = db;
        _stock = stock;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);
    private string UserName => User.FindFirstValue(ClaimTypes.Name) ?? "Admin";

    // ── GET /admin/stock ──────────────────────────────────────────────────────
    /// <summary>Lista todos os produtos com informações de estoque.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? filter = null,   // "low" | "out" | null = all
        [FromQuery] Guid? categoryId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == CompanyId && p.IsActive);

        if (filter == "out")
            query = query.Where(p => p.StockQty <= 0);
        else if (filter == "low")
            query = query.Where(p => p.ReorderPoint != null && p.StockQty <= p.ReorderPoint && p.StockQty > 0);

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new StockItemDto(
                p.Id,
                p.Name,
                p.Barcode,
                p.InternalCode,
                p.Unit,
                p.IsSoldByWeight,
                p.StockQty,
                p.ReorderPoint,
                p.PriceCents,
                p.CostCents,
                p.CategoryId
            ))
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // ── GET /admin/stock/alerts ───────────────────────────────────────────────
    /// <summary>Produtos com estoque zerado ou abaixo do ponto de reposição.</summary>
    [HttpGet("alerts")]
    public async Task<IActionResult> Alerts(CancellationToken ct)
    {
        var items = await _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == CompanyId && p.IsActive &&
                        (p.StockQty <= 0 || (p.ReorderPoint != null && p.StockQty <= p.ReorderPoint)))
            .OrderBy(p => p.StockQty)
            .ThenBy(p => p.Name)
            .Select(p => new StockAlertDto(
                p.Id,
                p.Name,
                p.Unit,
                p.IsSoldByWeight,
                p.StockQty,
                p.ReorderPoint,
                p.StockQty <= 0 ? "out" : "low"
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    // ── GET /admin/stock/{productId}/movements ────────────────────────────────
    [HttpGet("{productId:guid}/movements")]
    public async Task<IActionResult> Movements(
        Guid productId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var movements = await _db.StockMovements
            .AsNoTracking()
            .Where(m => m.CompanyId == CompanyId && m.ProductId == productId)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new StockMovementDto(
                m.Id,
                m.MovementType.ToString(),
                m.Quantity,
                m.BalanceBefore,
                m.BalanceAfter,
                m.Reason,
                m.SaleOrderId,
                m.ActorName,
                m.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(movements);
    }

    // ── POST /admin/stock/{productId}/adjust ──────────────────────────────────
    [HttpPost("{productId:guid}/adjust")]
    public async Task<IActionResult> Adjust(
        Guid productId,
        [FromBody] StockAdjustRequest req,
        CancellationToken ct)
    {
        if (req.Delta == 0)
            return BadRequest("Delta não pode ser zero.");

        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null)
            return NotFound("Produto não encontrado.");

        var movement = await _stock.AdjustAsync(
            CompanyId, productId, req.Delta,
            req.MovementType, req.Reason,
            UserName, ct);

        return Ok(new
        {
            movement.Id,
            movement.BalanceBefore,
            movement.BalanceAfter,
            NewStockQty = movement.BalanceAfter,
        });
    }

    // ── PUT /admin/stock/{productId}/reorder-point ────────────────────────────
    [HttpPut("{productId:guid}/reorder-point")]
    public async Task<IActionResult> SetReorderPoint(
        Guid productId,
        [FromBody] SetReorderPointRequest req,
        CancellationToken ct)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null)
            return NotFound("Produto não encontrado.");

        product.ReorderPoint  = req.ReorderPoint;
        product.UpdatedAtUtc  = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { product.Id, product.ReorderPoint });
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record StockItemDto(
    Guid    Id,
    string  Name,
    string? Barcode,
    string? InternalCode,
    string  Unit,
    bool    IsSoldByWeight,
    decimal StockQty,
    decimal? ReorderPoint,
    int     PriceCents,
    int     CostCents,
    Guid    CategoryId
);

public record StockAlertDto(
    Guid    Id,
    string  Name,
    string  Unit,
    bool    IsSoldByWeight,
    decimal StockQty,
    decimal? ReorderPoint,
    string  AlertLevel    // "out" | "low"
);

public record StockMovementDto(
    Guid     Id,
    string   MovementType,
    decimal  Quantity,
    decimal  BalanceBefore,
    decimal  BalanceAfter,
    string?  Reason,
    Guid?    SaleOrderId,
    string?  ActorName,
    DateTime CreatedAtUtc
);

public record StockAdjustRequest(
    decimal             Delta,
    StockMovementType   MovementType,
    string?             Reason
);

public record SetReorderPointRequest(decimal? ReorderPoint);
