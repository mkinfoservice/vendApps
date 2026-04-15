using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Gerencia os vínculos entre produtos e insumos consumidos na venda.
/// Cada vínculo define quanto de um insumo é consumido por unidade vendida do produto.
/// </summary>
[ApiController]
[Route("admin/products/{productId:guid}/supply-links")]
[Authorize(Roles = "admin,gerente")]
public class ProductSupplyLinksController : ControllerBase
{
    private readonly AppDbContext _db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    public ProductSupplyLinksController(AppDbContext db) => _db = db;

    // ── GET /admin/products/{id}/supply-links ─────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List(Guid productId, CancellationToken ct)
    {
        var exists = await _db.Products.AnyAsync(
            p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (!exists) return NotFound();

        var links = await _db.ProductSupplyLinks
            .Where(l => l.ProductId == productId && l.CompanyId == CompanyId)
            .Include(l => l.Supply)
            .OrderBy(l => l.Supply.Name)
            .Select(l => new SupplyLinkDto(
                l.Id,
                l.SupplyId,
                l.Supply.Name,
                l.Supply.Unit,
                l.QuantityPerUnit,
                l.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(links);
    }

    // ── POST /admin/products/{id}/supply-links ────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create(
        Guid productId,
        [FromBody] CreateSupplyLinkRequest req,
        CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(
            p => p.Id == productId && p.CompanyId == CompanyId, ct);
        if (product is null) return NotFound("Produto não encontrado.");

        var supply = await _db.Supplies.FirstOrDefaultAsync(
            s => s.Id == req.SupplyId && s.CompanyId == CompanyId, ct);
        if (supply is null) return NotFound("Insumo não encontrado.");

        // Verificar duplicata
        var duplicate = await _db.ProductSupplyLinks.AnyAsync(
            l => l.ProductId == productId && l.SupplyId == req.SupplyId, ct);
        if (duplicate)
            return Conflict($"O insumo '{supply.Name}' já está vinculado a este produto.");

        var link = new ProductSupplyLink
        {
            CompanyId       = CompanyId,
            ProductId       = productId,
            SupplyId        = req.SupplyId,
            QuantityPerUnit = req.QuantityPerUnit,
        };

        _db.ProductSupplyLinks.Add(link);
        await _db.SaveChangesAsync(ct);

        return Ok(new SupplyLinkDto(
            link.Id, supply.Id, supply.Name, supply.Unit,
            link.QuantityPerUnit, link.CreatedAtUtc));
    }

    // ── PUT /admin/products/{id}/supply-links/{linkId} ────────────────────────

    [HttpPut("{linkId:guid}")]
    public async Task<IActionResult> Update(
        Guid productId,
        Guid linkId,
        [FromBody] UpdateSupplyLinkRequest req,
        CancellationToken ct)
    {
        var link = await _db.ProductSupplyLinks
            .Include(l => l.Supply)
            .FirstOrDefaultAsync(
                l => l.Id == linkId && l.ProductId == productId && l.CompanyId == CompanyId, ct);

        if (link is null) return NotFound();

        link.QuantityPerUnit = req.QuantityPerUnit;
        await _db.SaveChangesAsync(ct);

        return Ok(new SupplyLinkDto(
            link.Id, link.SupplyId, link.Supply.Name, link.Supply.Unit,
            link.QuantityPerUnit, link.CreatedAtUtc));
    }

    // ── DELETE /admin/products/{id}/supply-links/{linkId} ─────────────────────

    [HttpDelete("{linkId:guid}")]
    public async Task<IActionResult> Delete(
        Guid productId,
        Guid linkId,
        CancellationToken ct)
    {
        var link = await _db.ProductSupplyLinks.FirstOrDefaultAsync(
            l => l.Id == linkId && l.ProductId == productId && l.CompanyId == CompanyId, ct);

        if (link is null) return NotFound();

        _db.ProductSupplyLinks.Remove(link);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record SupplyLinkDto(
    Guid     Id,
    Guid     SupplyId,
    string   SupplyName,
    string   Unit,
    decimal  QuantityPerUnit,
    DateTime CreatedAtUtc);

public record CreateSupplyLinkRequest(
    [Required] Guid    SupplyId,
    [Range(0.0001, double.MaxValue, ErrorMessage = "Quantidade deve ser maior que zero.")]
    decimal QuantityPerUnit);

public record UpdateSupplyLinkRequest(
    [Range(0.0001, double.MaxValue, ErrorMessage = "Quantidade deve ser maior que zero.")]
    decimal QuantityPerUnit);
