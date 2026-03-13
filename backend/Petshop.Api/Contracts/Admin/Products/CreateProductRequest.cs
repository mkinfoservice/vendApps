using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Scale;

namespace Petshop.Api.Contracts.Admin.Products;

public record CreateProductRequest(
    [Required, MaxLength(160)] string Name,
    string? Slug,
    [Required] Guid CategoryId,
    Guid? BrandId,
    string? InternalCode,
    string? Barcode,
    string? Description,
    string? Unit,
    int CostCents,
    int PriceCents,
    decimal StockQty,
    string? Ncm,
    bool IsActive = true,
    // ── Balança / venda por peso ─────────────────────────────
    bool IsSoldByWeight = false,
    [MaxLength(5)] string? ScaleProductCode = null,
    ScaleBarcodeMode ScaleBarcodeMode = ScaleBarcodeMode.WeightEncoded,
    decimal ScaleTareWeight = 0
);
