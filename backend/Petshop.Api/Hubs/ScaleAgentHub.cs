using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;

namespace Petshop.Api.Hubs;

/// <summary>
/// Hub SignalR para o serviço Windows Scale Agent.
///
/// Fluxo:
///   1. Agente chama POST /scale/agent/auth com AgentKey → recebe JWT.
///   2. Agente conecta aqui via WebSocket com o JWT no query "access_token".
///   3. Servidor envia "SyncProducts" com lista de produtos.
///   4. Agente programa a balança e confirma via AckSync.
/// </summary>
[Authorize(Roles = "scale_agent")]
public class ScaleAgentHub : Hub
{
    private readonly AppDbContext _db;

    public ScaleAgentHub(AppDbContext db) => _db = db;

    public override async Task OnConnectedAsync()
    {
        var agentId = AgentId();
        if (agentId.HasValue)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(agentId.Value));

            var agent = await _db.ScaleAgents.FindAsync(agentId.Value);
            if (agent != null)
            {
                agent.IsOnline    = true;
                agent.LastSeenUtc = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var agentId = AgentId();
        if (agentId.HasValue)
        {
            var agent = await _db.ScaleAgents.FindAsync(agentId.Value);
            if (agent != null)
            {
                agent.IsOnline = false;
                await _db.SaveChangesAsync();
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Chamado pelo agente após concluir (ou falhar) a sincronização de um dispositivo.
    /// status: "ok" | "error"
    /// </summary>
    public async Task AckSync(string deviceId, string status, string? errorMessage)
    {
        var companyId = CompanyId();
        if (!companyId.HasValue || !Guid.TryParse(deviceId, out var devId)) return;

        var device = await _db.ScaleDevices
            .Include(d => d.Agent)
            .FirstOrDefaultAsync(d => d.Id == devId && d.Agent.CompanyId == companyId.Value);

        if (device == null) return;

        if (status == "ok")
            device.LastSyncUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Guid? AgentId()
    {
        var v = Context.User?.FindFirst("agentId")?.Value;
        return Guid.TryParse(v, out var g) ? g : null;
    }

    private Guid? CompanyId()
    {
        var v = Context.User?.FindFirst("companyId")?.Value;
        return Guid.TryParse(v, out var g) ? g : null;
    }

    public static string GroupName(Guid agentId) => $"scale-agent-{agentId}";
}
