using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Contracts.Admin.Sources;

public record CreateSourceRequest(
    [Required, MaxLength(120)] string Name,
    SourceType SourceType,
    ConnectorType ConnectorType,
    string? ConnectionConfigJson,
    bool IsActive,
    SyncMode SyncMode,
    string? ScheduleCron
);
