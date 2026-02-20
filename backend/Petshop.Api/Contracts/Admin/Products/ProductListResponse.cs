namespace Petshop.Api.Contracts.Admin.Products;

public record ProductListResponse(int Page, int PageSize, int Total, IReadOnlyList<ProductListItem> Items);

public record ProductListItem(
    Guid Id,
    string Name,
    string Slug,
    string? InternalCode,
    string? Barcode,
    string? CategoryName,
    string? BrandName,
    string Unit,
    int PriceCents,
    int CostCents,
    decimal MarginPercent,
    decimal StockQty,
    bool IsActive,
    DateTime? UpdatedAtUtc,
    string? ImageUrl
);
