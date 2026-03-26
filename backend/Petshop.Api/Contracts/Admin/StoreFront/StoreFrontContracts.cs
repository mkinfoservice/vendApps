using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Contracts.Admin.StoreFront;

// ── Responses ────────────────────────────────────────────────────────────────

public record BannerSlideResponse(
    Guid   Id,
    string? ImageUrl,
    string? Title,
    string? Subtitle,
    string? CtaText,
    string  CtaType,
    string? CtaTarget,
    bool    CtaNewTab,
    int     SortOrder,
    bool    IsActive);

public record StoreFrontConfigResponse(
    Guid                       Id,
    string                     PrimaryColor,
    int                        BannerIntervalSecs,
    IReadOnlyList<BannerSlideResponse> Slides);

// ── Requests — config geral ───────────────────────────────────────────────────

public record UpdateStoreFrontConfigRequest(
    [MaxLength(10)]  string? PrimaryColor,
    int? BannerIntervalSecs);

// ── Requests — slides ─────────────────────────────────────────────────────────

public record UpsertBannerSlideRequest(
    string?          ImageUrl,   // URL ou data URI base64 — sem limite de tamanho
    [MaxLength(120)] string? Title,
    [MaxLength(200)] string? Subtitle,
    [MaxLength(60)]  string? CtaText,
    [MaxLength(20)]  string? CtaType,    // none | category | product | external
    [MaxLength(500)] string? CtaTarget,
    bool?   CtaNewTab,
    int?    SortOrder,
    bool?   IsActive);

public record ReorderSlidesRequest(IReadOnlyList<Guid> OrderedIds);
