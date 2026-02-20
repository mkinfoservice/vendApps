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
    bool? IsActive
);
