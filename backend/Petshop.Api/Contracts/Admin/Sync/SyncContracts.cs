using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Contracts.Admin.Sync;

public record ManualSyncRequest(
    Guid SourceId,
    SyncType SyncType,
    DateTime? UpdatedSince,
    int BatchSize = 100
);

public record SyncJobResponse(
    Guid Id,
    Guid ExternalSourceId,
    string SourceName,
    string TriggeredBy,
    string SyncType,
    string Status,
    int TotalFetched,
    int Inserted,
    int Updated,
    int Unchanged,
    int Skipped,
    int Conflicts,
    DateTime? StartedAtUtc,
    DateTime? FinishedAtUtc,
    string? ErrorMessage
);

public record SyncJobListResponse(int Page, int PageSize, int Total, IReadOnlyList<SyncJobResponse> Items);

public record SyncJobItemResponse(
    Guid Id,
    string? ExternalId,
    string? InternalCode,
    string? Barcode,
    string Action,
    string? Reason,
    string? BeforeJson,
    string? AfterJson
);

public record SyncJobItemsResponse(int Page, int PageSize, int Total, IReadOnlyList<SyncJobItemResponse> Items);
