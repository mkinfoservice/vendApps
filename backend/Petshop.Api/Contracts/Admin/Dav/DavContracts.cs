using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Contracts.Admin.Dav;

// ════════════════════════════════════════════════════════════════
// REQUESTS
// ════════════════════════════════════════════════════════════════

public record CreateSalesQuoteRequest(
    [Required, MaxLength(120)] string CustomerName,
    string? CustomerPhone,
    string? CustomerDocument,
    string PaymentMethod = "PIX",
    string? Notes = null,
    IReadOnlyList<CreateSalesQuoteItemRequest>? Items = null
);

public record CreateSalesQuoteItemRequest(
    [Required] Guid ProductId,
    decimal Qty,
    decimal? WeightKg = null
);

public record UpdateSalesQuoteRequest(
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerDocument,
    string? PaymentMethod,
    int? DiscountCents,
    string? Notes
);

public record AddSalesQuoteItemRequest(
    [Required] Guid ProductId,
    decimal Qty,
    decimal? WeightKg = null
);

public record UpdateSalesQuoteItemRequest(
    decimal Qty,
    decimal? WeightKg = null
);

public record ConfirmFiscalRequest(string? Notes = null);

public record ConvertToPdvRequest(string? Notes = null);

// ════════════════════════════════════════════════════════════════
// RESPONSES
// ════════════════════════════════════════════════════════════════

public record SalesQuoteListResponse(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyList<SalesQuoteListItem> Items
);

public record SalesQuoteListItem(
    Guid Id,
    string PublicId,
    string CustomerName,
    string? CustomerPhone,
    string PaymentMethod,
    int TotalCents,
    string Status,
    string Origin,
    Guid? OriginOrderId,
    int ItemCount,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc
);

public record SalesQuoteDetailResponse(
    Guid Id,
    string PublicId,
    Guid CompanyId,
    string CustomerName,
    string? CustomerPhone,
    string? CustomerDocument,
    string PaymentMethod,
    int SubtotalCents,
    int DiscountCents,
    int TotalCents,
    string Status,
    string Origin,
    Guid? OriginOrderId,
    Guid? FiscalDocumentId,
    Guid? SaleOrderId,
    string? Notes,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    DateTime? FiscalConfirmedAtUtc,
    DateTime? ConvertedAtUtc,
    IReadOnlyList<SalesQuoteItemDto> Items
);

public record SalesQuoteItemDto(
    Guid Id,
    Guid ProductId,
    string ProductNameSnapshot,
    string? ProductBarcodeSnapshot,
    decimal Qty,
    int UnitPriceCentsSnapshot,
    int TotalCents,
    bool IsSoldByWeight,
    decimal? WeightKg
);
