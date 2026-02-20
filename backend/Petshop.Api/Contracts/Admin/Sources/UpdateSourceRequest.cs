using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Contracts.Admin.Sources;

public record UpdateSourceRequest(
    string? Name,
    string? ConnectionConfigJson,
    bool? IsActive,
    SyncMode? SyncMode,
    string? ScheduleCron
);
