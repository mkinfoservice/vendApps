using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Contracts.Admin.Sources;

public record SourceListResponse(IReadOnlyList<SourceListItem> Items);

public record SourceListItem(
    Guid Id,
    string Name,
    SourceType SourceType,
    ConnectorType ConnectorType,
    bool IsActive,
    SyncMode SyncMode,
    string? ScheduleCron,
    DateTime? LastSyncAtUtc,
    DateTime CreatedAtUtc
);

public record TestConnectionResponse(bool Success, string Message, int SampleCount);
