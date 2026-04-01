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
[Authorize(Roles = "admin,gerente,atendente")]
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
        [FromQuery] bool? excludeSupplies,
        [FromQuery] bool? withoutOrders,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 500) pageSize = 20;

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
        if (excludeSupplies == true) q = q.Where(p => !p.IsSupply);
        if (withoutOrders == true)
        {
            q = q.Where(p =>
                !_db.OrderItems.Any(i => i.ProductId == p.Id) &&
                !_db.SaleOrderItems.Any(i => i.ProductId == p.Id));
        }

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductListItem(
                p.Id, p.Name, p.Slug, p.InternalCode, p.Barcode,
                p.Category.Name, p.Brand != null ? p.Brand.Name : null,
                p.Unit, p.PriceCents, p.CostCents, p.MarginPercent, p.StockQty,
                p.IsActive, p.UpdatedAtUtc, p.ImageUrl,
                p.IsSoldByWeight, p.ScaleProductCode, p.HasAddons, p.IsBestSeller))
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
            .Include(p => p.Addons.Where(a => a.IsActive).OrderBy(a => a.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == CompanyId, ct);

        if (p == null) return NotFound("Produto não encontrado.");

        return Ok(new ProductDetailResponse(
            p.Id, p.CompanyId, p.Name, p.Slug, p.InternalCode, p.Barcode,
            p.CategoryId, p.Category.Name, p.BrandId, p.Brand?.Name,
            p.Description, p.Unit, p.PriceCents, p.CostCents, p.MarginPercent,
            p.StockQty, p.Ncm, p.IsActive, p.CreatedAtUtc, p.UpdatedAtUtc,
            p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Id, i.Url, i.StorageProvider, i.IsPrimary, i.SortOrder)).ToList(),
            p.Variants.Select(v => new ProductVariantDto(v.Id, v.VariantKey, v.VariantValue, v.Barcode, v.PriceCents, v.StockQty)).ToList(),
            p.IsSoldByWeight, p.ScaleProductCode, p.ScaleBarcodeMode, p.ScaleTareWeight,
            p.HasAddons, p.IsSupply,
            p.Addons.Select(a => new ProductAddonDto(a.Id, a.Name, a.PriceCents, a.SortOrder, a.IsActive)).ToList()
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
            CompanyId        = CompanyId,
            Name             = req.Name,
            Slug             = slug,
            CategoryId       = req.CategoryId,
            BrandId          = req.BrandId,
            InternalCode     = req.InternalCode,
            Barcode          = req.Barcode,
            Description      = req.Description,
            Unit             = req.Unit ?? "UN",
            CostCents        = req.CostCents,
            PriceCents       = req.PriceCents,
            StockQty         = req.StockQty,
            Ncm              = req.Ncm,
            IsActive         = req.IsActive,
            IsSoldByWeight   = req.IsSoldByWeight,
            ScaleProductCode = req.ScaleProductCode?.Trim(),
            ScaleBarcodeMode = req.ScaleBarcodeMode,
            ScaleTareWeight  = req.ScaleTareWeight,
            HasAddons        = req.HasAddons,
            IsSupply         = req.IsSupply,
            CreatedAtUtc     = DateTime.UtcNow
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
        if (req.IsSoldByWeight.HasValue) product.IsSoldByWeight = req.IsSoldByWeight.Value;
        if (req.ScaleProductCode != null) product.ScaleProductCode = req.ScaleProductCode.Trim();
        if (req.ScaleBarcodeMode.HasValue) product.ScaleBarcodeMode = req.ScaleBarcodeMode.Value;
        if (req.ScaleTareWeight.HasValue) product.ScaleTareWeight = req.ScaleTareWeight.Value;
        if (req.HasAddons.HasValue) product.HasAddons = req.HasAddons.Value;
        if (req.IsSupply.HasValue) product.IsSupply = req.IsSupply.Value;

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

        var hasOrders = await _db.OrderItems.AnyAsync(i => i.ProductId == id, ct) || await _db.SaleOrderItems.AnyAsync(i => i.ProductId == id, ct);
        if (hasOrders)
            return Conflict(new { error = "Produto possui pedidos vinculados e não pode ser excluído. Inative-o se necessário." });

        foreach (var img in product.Images)
            await _imageStorage.DeleteAsync(img.Url, ct);

        await _db.StockMovements.Where(m => m.ProductId == id).ExecuteDeleteAsync(ct);
        await _db.ProductPriceHistories.Where(h => h.ProductId == id).ExecuteDeleteAsync(ct);
        await _db.ProductChangeLogs.Where(l => l.ProductId == id).ExecuteDeleteAsync(ct);

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // â”€â”€ POST /admin/products/bulk-delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteProductsRequest req, CancellationToken ct)
    {
        if (req.ProductIds is null || req.ProductIds.Count == 0)
            return BadRequest(new { error = "Nenhum produto informado para exclusÃ£o." });

        var ids = req.ProductIds.Distinct().ToList();

        var products = await _db.Products
            .Include(p => p.Images)
            .Where(p => p.CompanyId == CompanyId && ids.Contains(p.Id))
            .ToListAsync(ct);

        var foundIds = products.Select(p => p.Id).ToHashSet();
        var notFoundIds = ids.Where(id => !foundIds.Contains(id)).ToList();

        var blockedIds = await _db.Products
            .Where(p => p.CompanyId == CompanyId && ids.Contains(p.Id))
            .Where(p =>
                _db.OrderItems.Any(i => i.ProductId == p.Id) ||
                _db.SaleOrderItems.Any(i => i.ProductId == p.Id))
            .Select(p => p.Id)
            .ToListAsync(ct);

        var blockedSet = blockedIds.ToHashSet();
        var deletable = products.Where(p => !blockedSet.Contains(p.Id)).ToList();

        foreach (var p in deletable)
        {
            foreach (var img in p.Images)
                await _imageStorage.DeleteAsync(img.Url, ct);
        }

        var deletableIds = deletable.Select(p => p.Id).ToList();
        if (deletableIds.Count > 0)
        {
            await _db.StockMovements.Where(m => deletableIds.Contains(m.ProductId)).ExecuteDeleteAsync(ct);
            await _db.ProductPriceHistories.Where(h => deletableIds.Contains(h.ProductId)).ExecuteDeleteAsync(ct);
            await _db.ProductChangeLogs.Where(l => deletableIds.Contains(l.ProductId)).ExecuteDeleteAsync(ct);
            _db.Products.RemoveRange(deletable);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new BulkDeleteProductsResponse(
            Requested: ids.Count,
            Deleted: deletableIds.Count,
            Blocked: blockedIds.Count,
            NotFound: notFoundIds.Count,
            BlockedIds: blockedIds,
            NotFoundIds: notFoundIds
        ));
    }

    [HttpPost("delete-without-orders")]
    public async Task<IActionResult> DeleteWithoutOrders([FromBody] DeleteWithoutOrdersRequest req, CancellationToken ct)
    {
        var query = _db.Products
            .Where(p => p.CompanyId == CompanyId)
            .Where(p =>
                !_db.OrderItems.Any(i => i.ProductId == p.Id) &&
                !_db.SaleOrderItems.Any(i => i.ProductId == p.Id));

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var search = req.Search.Trim();
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%")
                || (p.InternalCode != null && EF.Functions.ILike(p.InternalCode, $"%{search}%"))
                || (p.Barcode != null && EF.Functions.ILike(p.Barcode, $"%{search}%")));
        }

        if (req.Active.HasValue)
            query = query.Where(p => p.IsActive == req.Active.Value);

        var candidateIds = await query.Select(p => p.Id).ToListAsync(ct);
        if (candidateIds.Count == 0)
            return Ok(new DeleteWithoutOrdersResponse(0, 0));

        var imageUrls = await _db.ProductImages
            .Where(i => candidateIds.Contains(i.ProductId))
            .Select(i => i.Url)
            .ToListAsync(ct);

        foreach (var url in imageUrls)
        {
            try { await _imageStorage.DeleteAsync(url, ct); }
            catch { /* best effort */ }
        }

        await _db.StockMovements.Where(m => candidateIds.Contains(m.ProductId)).ExecuteDeleteAsync(ct);
        await _db.ProductPriceHistories.Where(h => candidateIds.Contains(h.ProductId)).ExecuteDeleteAsync(ct);
        await _db.ProductChangeLogs.Where(l => candidateIds.Contains(l.ProductId)).ExecuteDeleteAsync(ct);
        await _db.ProductImages.Where(i => candidateIds.Contains(i.ProductId)).ExecuteDeleteAsync(ct);
        var deleted = await _db.Products.Where(p => candidateIds.Contains(p.Id)).ExecuteDeleteAsync(ct);

        return Ok(new DeleteWithoutOrdersResponse(candidateIds.Count, deleted));
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
            CompanyId        = CompanyId,
            Name             = $"{original.Name} (Cópia)",
            Slug             = newSlug,
            CategoryId       = original.CategoryId,
            BrandId          = original.BrandId,
            InternalCode     = req?.NewInternalCode ?? original.InternalCode,
            Barcode          = req?.NewBarcode,
            Description      = original.Description,
            Unit             = original.Unit,
            CostCents        = original.CostCents,
            PriceCents       = original.PriceCents,
            MarginPercent    = original.MarginPercent,
            StockQty         = 0,
            Ncm              = original.Ncm,
            IsActive         = false,
            IsSoldByWeight   = original.IsSoldByWeight,
            ScaleProductCode = null, // cópia não herda código de balança — deve ser cadastrado
            ScaleBarcodeMode = original.ScaleBarcodeMode,
            ScaleTareWeight  = original.ScaleTareWeight,
            CreatedAtUtc     = DateTime.UtcNow
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
public record BulkDeleteProductsRequest(List<Guid> ProductIds);
public record BulkDeleteProductsResponse(
    int Requested,
    int Deleted,
    int Blocked,
    int NotFound,
    IReadOnlyList<Guid> BlockedIds,
    IReadOnlyList<Guid> NotFoundIds
);
public record DeleteWithoutOrdersRequest(string? Search, bool? Active);
public record DeleteWithoutOrdersResponse(int Matched, int Deleted);
