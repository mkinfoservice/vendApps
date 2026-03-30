using Petshop.Api.Entities.Scale;

namespace Petshop.Api.Contracts.Admin.Products;

public record UpdateProductRequest(
    string? Name,
    string? Slug,
    Guid? CategoryId,
    Guid? BrandId,
    string? InternalCode,
    string? Barcode,
    string? Description,
    string? Unit,
    int? CostCents,
    int? PriceCents,
    decimal? StockQty,
    string? Ncm,
    bool? IsActive,
    // ── Balança / venda por peso ─────────────────────────────
    bool? IsSoldByWeight = null,
    string? ScaleProductCode = null,
    ScaleBarcodeMode? ScaleBarcodeMode = null,
    decimal? ScaleTareWeight = null,
    // ── Adicionais / Insumo ───────────────────────────────────
    bool? HasAddons = null,
    bool? IsSupply = null
);
