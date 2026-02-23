using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Products;
using Petshop.Api.Data;
using Petshop.Api.Entities.Audit;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Models;
using Petshop.Api.Services.Images;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/products")]
[Authorize(Roles = "admin")]
public class AdminProductsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageStorageProvider _imageStorage;

    public AdminProductsController(AppDbContext db, IImageStorageProvider imageStorage)
    {
        _db = db;
        _imageStorage = imageStorage;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/products ───────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] Guid? categoryId,
        [FromQuery] Guid? brandId,
        [FromQuery] bool? active,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 20;

        var q = _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == CompanyId)
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(p => EF.Functions.ILike(p.Name, $"%{search}%")
                || (p.InternalCode != null && EF.Functions.ILike(p.InternalCode, $"%{search}%"))
                || (p.Barcode != null && EF.Functions.ILike(p.Barcode, $"%{search}%")));

        if (categoryId.HasValue) q = q.Where(p => p.CategoryId == categoryId.Value);
        if (brandId.HasValue)    q = q.Where(p => p.BrandId == brandId.Value);
        if (active.HasValue)     q = q.Where(p => p.IsActive == active.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductListItem(
                p.Id, p.Name, p.Slug, p.InternalCode, p.Barcode,
                p.Category.Name, p.Brand != null ? p.Brand.Name : null,
                p.Unit, p.PriceCents, p.CostCents, p.MarginPercent, p.StockQty,
                p.IsActive, p.UpdatedAtUtc, p.ImageUrl))
            .ToListAsync(ct);

        return Ok(new ProductListResponse(page, pageSize, total, items));
    }

    // ── GET /admin/products/{id} ──────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var p = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (p == null) return NotFound("Produto não encontrado.");

        return Ok(new ProductDetailResponse(
            p.Id, p.CompanyId, p.Name, p.Slug, p.InternalCode, p.Barcode,
            p.CategoryId, p.Category.Name, p.BrandId, p.Brand?.Name,
            p.Description, p.Unit, p.PriceCents, p.CostCents, p.MarginPercent,
            p.StockQty, p.Ncm, p.IsActive, p.CreatedAtUtc, p.UpdatedAtUtc,
            p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Id, i.Url, i.StorageProvider, i.IsPrimary, i.SortOrder)).ToList(),
            p.Variants.Select(v => new ProductVariantDto(v.Id, v.VariantKey, v.VariantValue, v.Barcode, v.PriceCents, v.StockQty)).ToList()
        ));
    }

    // ── POST /admin/products ──────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest req, CancellationToken ct)
    {
        var slug = string.IsNullOrWhiteSpace(req.Slug) ? Slugify(req.Name) : req.Slug;
        if (await _db.Products.AnyAsync(p => p.CompanyId == CompanyId && p.Slug == slug, ct))
            return Conflict($"Já existe um produto com o slug '{slug}'.");

        var product = new Product
        {
            CompanyId    = CompanyId,
            Name         = req.Name,
            Slug         = slug,
            CategoryId   = req.CategoryId,
            BrandId      = req.BrandId,
            InternalCode = req.InternalCode,
            Barcode      = req.Barcode,
            Description  = req.Description,
            Unit         = req.Unit ?? "UN",
            CostCents    = req.CostCents,
            PriceCents   = req.PriceCents,
            StockQty     = req.StockQty,
            Ncm          = req.Ncm,
            IsActive     = req.IsActive,
            CreatedAtUtc = DateTime.UtcNow
        };
        product.MarginPercent = product.PriceCents > 0
            ? Math.Round((decimal)(product.PriceCents - product.CostCents) / product.PriceCents * 100, 4)
            : 0;

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);

        _db.ProductPriceHistories.Add(new ProductPriceHistory
        {
            ProductId = product.Id, PriceCents = product.PriceCents,
            CostCents = product.CostCents, MarginPercent = product.MarginPercent,
            ChangedAtUtc = DateTime.UtcNow, Source = ChangeSource.Admin
        });
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, new { product.Id });
    }

    // ── PUT /admin/products/{id} ──────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest req, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);
        if (product == null) return NotFound("Produto não encontrado.");

        bool priceChanged = false;

        if (req.Name != null) product.Name = req.Name;
        if (req.Slug != null) product.Slug = req.Slug;
        if (req.CategoryId.HasValue) product.CategoryId = req.CategoryId.Value;
        if (req.BrandId.HasValue) product.BrandId = req.BrandId.Value;
        if (req.InternalCode != null) product.InternalCode = req.InternalCode;
        if (req.Barcode != null) product.Barcode = req.Barcode;
        if (req.Description != null) product.Description = req.Description;
        if (req.Unit != null) product.Unit = req.Unit;
        if (req.Ncm != null) product.Ncm = req.Ncm;
        if (req.IsActive.HasValue) product.IsActive = req.IsActive.Value;
        if (req.StockQty.HasValue) product.StockQty = req.StockQty.Value;

        if (req.PriceCents.HasValue && req.PriceCents.Value != product.PriceCents)
        {
            _db.ProductChangeLogs.Add(new ProductChangeLog
            {
                CompanyId = CompanyId, ProductId = product.Id, Source = ChangeSource.Admin,
                FieldName = "PriceCents", OldValue = product.PriceCents.ToString(),
                NewValue = req.PriceCents.Value.ToString(), ChangedAtUtc = DateTime.UtcNow
            });
            product.PriceCents = req.PriceCents.Value;
            priceChanged = true;
        }
        if (req.CostCents.HasValue && req.CostCents.Value != product.CostCents)
        {
            product.CostCents = req.CostCents.Value;
            priceChanged = true;
        }

        product.MarginPercent = product.PriceCents > 0
            ? Math.Round((decimal)(product.PriceCents - product.CostCents) / product.PriceCents * 100, 4)
            : 0;
        product.UpdatedAtUtc = DateTime.UtcNow;

        if (priceChanged)
        {
            _db.ProductPriceHistories.Add(new ProductPriceHistory
            {
                ProductId = product.Id, PriceCents = product.PriceCents,
                CostCents = product.CostCents, MarginPercent = product.MarginPercent,
                ChangedAtUtc = DateTime.UtcNow, Source = ChangeSource.Admin
            });
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── PATCH /admin/products/{id}/status ─────────────────────────────────────
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> ToggleStatus(Guid id, [FromBody] bool isActive, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);
        if (product == null) return NotFound("Produto não encontrado.");

        product.IsActive = isActive;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /admin/products/{id} ───────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);
        if (product == null) return NotFound("Produto não encontrado.");

        var hasOrders = await _db.OrderItems.AnyAsync(i => i.ProductId == id, ct);
        if (hasOrders)
            return Conflict(new { error = "Produto possui pedidos vinculados e não pode ser excluído. Inative-o se necessário." });

        foreach (var img in product.Images)
            await _imageStorage.DeleteAsync(img.Url, ct);

        await _db.ProductPriceHistories.Where(h => h.ProductId == id).ExecuteDeleteAsync(ct);
        await _db.ProductChangeLogs.Where(l => l.ProductId == id).ExecuteDeleteAsync(ct);

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /admin/products/{id}/clone ───────────────────────────────────────
    [HttpPost("{id:guid}/clone")]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneProductRequest? req, CancellationToken ct)
    {
        var original = await _db.Products
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);
        if (original == null) return NotFound("Produto não encontrado.");

        var newSlug = req?.NewSlug ?? $"{original.Slug}-copia-{Guid.NewGuid().ToString()[..6]}";
        var clone = new Product
        {
            CompanyId    = CompanyId,
            Name         = $"{original.Name} (Cópia)",
            Slug         = newSlug,
            CategoryId   = original.CategoryId,
            BrandId      = original.BrandId,
            InternalCode = req?.NewInternalCode ?? original.InternalCode,
            Barcode      = req?.NewBarcode,
            Description  = original.Description,
            Unit         = original.Unit,
            CostCents    = original.CostCents,
            PriceCents   = original.PriceCents,
            MarginPercent = original.MarginPercent,
            StockQty     = 0,
            Ncm          = original.Ncm,
            IsActive     = false,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Products.Add(clone);
        await _db.SaveChangesAsync(ct);
        return Ok(new { clone.Id });
    }

    // ── POST /admin/products/{id}/images ──────────────────────────────────────
    [HttpPost("{id:guid}/images")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file, CancellationToken ct)
    {
        var product = await _db.Products.Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);
        if (product == null) return NotFound("Produto não encontrado.");

        if (file.Length == 0) return BadRequest("Arquivo vazio.");

        await using var stream = file.OpenReadStream();
        var url = await _imageStorage.SaveAsync(stream, file.FileName, file.ContentType, ct);

        var isPrimary = !product.Images.Any();
        var sortOrder = product.Images.Count;

        var img = new Entities.Catalog.ProductImage
        {
            ProductId = id, Url = url,
            StorageProvider = _imageStorage.ProviderName,
            IsPrimary = isPrimary, SortOrder = sortOrder
        };
        _db.ProductImages.Add(img);

        // Atualiza ImageUrl legada com a primeira imagem
        if (isPrimary) product.ImageUrl = url;

        await _db.SaveChangesAsync(ct);
        return Ok(new { img.Id, img.Url, img.IsPrimary });
    }

    // ── DELETE /admin/products/{id}/images/{imageId} ──────────────────────────
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var img = await _db.ProductImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == id, ct);
        if (img == null) return NotFound();

        await _imageStorage.DeleteAsync(img.Url, ct);
        _db.ProductImages.Remove(img);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── GET /admin/products/{id}/price-history ────────────────────────────────
    [HttpGet("{id:guid}/price-history")]
    public async Task<IActionResult> GetPriceHistory(Guid id, CancellationToken ct)
    {
        var history = await _db.ProductPriceHistories
            .AsNoTracking()
            .Where(h => h.ProductId == id)
            .OrderByDescending(h => h.ChangedAtUtc)
            .Take(50)
            .Select(h => new { h.PriceCents, h.CostCents, h.MarginPercent, h.ChangedAtUtc, Source = h.Source.ToString(), h.SyncJobId })
            .ToListAsync(ct);

        return Ok(history);
    }

    // ── GET /admin/products/{id}/changelogs ───────────────────────────────────
    [HttpGet("{id:guid}/changelogs")]
    public async Task<IActionResult> GetChangeLogs(Guid id, CancellationToken ct)
    {
        var logs = await _db.ProductChangeLogs
            .AsNoTracking()
            .Where(l => l.ProductId == id)
            .OrderByDescending(l => l.ChangedAtUtc)
            .Take(100)
            .Select(l => new { l.FieldName, l.OldValue, l.NewValue, l.ChangedAtUtc, Source = l.Source.ToString(), l.ChangedByUserId, l.SyncJobId })
            .ToListAsync(ct);

        return Ok(logs);
    }

    private static string Slugify(string text) =>
        System.Text.RegularExpressions.Regex.Replace(
            text.Trim().ToLowerInvariant()
                .Replace("ã", "a").Replace("â", "a").Replace("á", "a").Replace("à", "a")
                .Replace("ê", "e").Replace("é", "e").Replace("è", "e")
                .Replace("î", "i").Replace("í", "i")
                .Replace("ô", "o").Replace("ó", "o").Replace("õ", "o")
                .Replace("û", "u").Replace("ú", "u").Replace("ü", "u")
                .Replace("ç", "c").Replace(" ", "-"),
            @"[^a-z0-9\-]", "");
}

public record CloneProductRequest(string? NewInternalCode, string? NewBarcode, string? NewSlug);
