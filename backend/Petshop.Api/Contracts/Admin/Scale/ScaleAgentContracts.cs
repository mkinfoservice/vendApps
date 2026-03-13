namespace Petshop.Api.Contracts.Admin.Scale;

// ── Requests ──────────────────────────────────────────────────────────────────

public record CreateScaleAgentRequest(string MachineName, string? Notes);

public record UpdateScaleAgentRequest(string MachineName, string? Notes);

public record CreateScaleDeviceRequest(
    string Name,
    string ScaleModel,   // FilizolaP | FilizolaST | TolVdo | Generic
    string PortName,
    int    BaudRate);

public record UpdateScaleDeviceRequest(
    string Name,
    string ScaleModel,
    string PortName,
    int    BaudRate,
    bool   IsActive);

public record AgentAuthRequest(string AgentKey);

// ── Responses ─────────────────────────────────────────────────────────────────

public record AgentAuthResponse(string AccessToken, Guid AgentId, Guid CompanyId);

public record ScaleAgentListItem(
    Guid      Id,
    string    MachineName,
    bool      IsOnline,
    DateTime? LastSeenUtc,
    int       DeviceCount,
    string?   Notes);

public record ScaleAgentDetail(
    Guid     Id,
    string   MachineName,
    string   AgentKey,
    bool     IsOnline,
    DateTime? LastSeenUtc,
    string?  Notes,
    List<ScaleDeviceDto> Devices);

public record ScaleDeviceDto(
    Guid      Id,
    string    Name,
    string    ScaleModel,
    string    PortName,
    int       BaudRate,
    bool      IsActive,
    DateTime? LastSyncUtc);
