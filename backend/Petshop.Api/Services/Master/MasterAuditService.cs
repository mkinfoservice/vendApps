using System.Security.Claims;
using System.Text.Json;
using Petshop.Api.Data;
using Petshop.Api.Entities.Master;

namespace Petshop.Api.Services.Master;

/// <summary>
/// Grava entradas imutáveis no MasterAuditLog.
/// Sempre salva imediatamente (SaveChangesAsync próprio) para garantir
/// que o log persiste mesmo que a transação principal falhe.
/// </summary>
public class MasterAuditService
{
    private readonly AppDbContext _db;

    public MasterAuditService(AppDbContext db)
    {
        _db = db;
    }

    /// <param name="actor">HttpContext.User do controller (extraído automaticamente).</param>
    /// <param name="ipAddress">IP do requisitante.</param>
    /// <param name="action">Ação executada: "company.create", "company.suspend", etc.</param>
    /// <param name="targetType">"company" | "admin_user" | "settings" | "whatsapp"</param>
    /// <param name="targetId">ID (string) do recurso afetado.</param>
    /// <param name="targetName">Nome legível do recurso (para facilitar leitura do log).</param>
    /// <param name="payload">Dados da operação (serializado como JSON). Evite dados sensíveis.</param>
    public async Task LogAsync(
        ClaimsPrincipal actor,
        string ipAddress,
        string action,
        string targetType,
        string targetId,
        string? targetName = null,
        object? payload = null,
        CancellationToken ct = default)
    {
        _db.MasterAuditLogs.Add(new MasterAuditLog
        {
            ActorUsername = actor.Identity?.Name ?? "unknown",
            ActorRole = actor.FindFirstValue(ClaimTypes.Role) ?? "unknown",
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            TargetName = targetName,
            PayloadJson = payload is not null
                ? JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false })
                : null,
            IpAddress = ipAddress,
        });

        await _db.SaveChangesAsync(ct);
    }
}
