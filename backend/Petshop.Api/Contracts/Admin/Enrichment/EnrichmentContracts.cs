using Petshop.Api.Services.Enrichment;

namespace Petshop.Api.Contracts.Admin.Enrichment;

// ── Requests ──────────────────────────────────────────────────────────────────

public record CreateEnrichmentBatchRequest(
    /// <summary>all | without-image | recently-imported | by-category</summary>
    string Scope = "all",
    Guid? CategoryId    = null,
    int?  RecentHours   = null,
    bool  IncludeImages = false
);

public record UpdateEnrichmentConfigRequest(
    decimal AutoApplyImageThreshold,
    decimal ReviewImageThreshold,
    decimal AutoApplyNameThreshold,
    int     BatchSize,
    int     DelayBetweenItemsMs,
    bool    EnableImageMatching,
    bool    EnableNameNormalization
);

public record BulkApproveNamesRequest(IReadOnlyList<Guid> SuggestionIds);
public record BulkRejectNamesRequest(IReadOnlyList<Guid> SuggestionIds);

// ── Responses — Batch ─────────────────────────────────────────────────────────

public record EnrichmentBatchResponse(
    Guid      Id,
    string    Trigger,
    string    Status,
    int       TotalQueued,
    int       Processed,
    int       NamesNormalized,
    int       ImagesApplied,
    int       PendingReview,
    int       FailedItems,
    DateTime? StartedAtUtc,
    DateTime? FinishedAtUtc,
    string?   ErrorMessage,
    DateTime  CreatedAtUtc
);

public record EnrichmentBatchListResponse(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyList<EnrichmentBatchResponse> Items
);

// ── Responses — Revisão ───────────────────────────────────────────────────────

public record NameSuggestionResponse(
    Guid      Id,
    Guid      ProductId,
    string    ProductName,
    string    OriginalName,
    string    SuggestedName,
    decimal   ConfidenceScore,
    string    Source,
    string    Status,
    DateTime  CreatedAtUtc
);

public record NameSuggestionListResponse(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyList<NameSuggestionResponse> Items
);

public record ImageCandidateResponse(
    Guid      Id,
    Guid      ProductId,
    string    ProductName,
    string?   CandidateUrl,
    string?   CandidateName,
    string?   CandidateBrand,
    string?   CandidateBarcode,
    string    Source,
    decimal   ConfidenceScore,
    string?   ScoreBreakdownJson,
    string    Status,
    DateTime  CreatedAtUtc
);

public record ImageCandidateListResponse(
    int Page,
    int PageSize,
    int Total,
    IReadOnlyList<ImageCandidateResponse> Items
);

// ── Responses — Config ────────────────────────────────────────────────────────

public record EnrichmentConfigResponse(
    decimal AutoApplyImageThreshold,
    decimal ReviewImageThreshold,
    decimal AutoApplyNameThreshold,
    int     BatchSize,
    int     DelayBetweenItemsMs,
    bool    EnableImageMatching,
    bool    EnableNameNormalization
);
