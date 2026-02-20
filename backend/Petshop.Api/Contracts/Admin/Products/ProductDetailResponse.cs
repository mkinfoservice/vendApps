namespace Petshop.Api.Contracts.Admin.Products;

public record ProductDetailResponse(
    Guid Id,
    Guid CompanyId,
    string Name,
    string Slug,
    string? InternalCode,
    string? Barcode,
    Guid CategoryId,
    string? CategoryName,
    Guid? BrandId,
    string? BrandName,
    string? Description,
    string Unit,
    int PriceCents,
    int CostCents,
    decimal MarginPercent,
    decimal StockQty,
    string? Ncm,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductVariantDto> Variants
);

public record ProductImageDto(Guid Id, string Url, string StorageProvider, bool IsPrimary, int SortOrder);
public record ProductVariantDto(Guid Id, string VariantKey, string VariantValue, string? Barcode, int? PriceCents, decimal StockQty);
