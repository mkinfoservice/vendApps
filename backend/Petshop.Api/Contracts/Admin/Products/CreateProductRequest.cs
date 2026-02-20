using System.ComponentModel.DataAnnotations;

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
    bool IsActive = true
);
