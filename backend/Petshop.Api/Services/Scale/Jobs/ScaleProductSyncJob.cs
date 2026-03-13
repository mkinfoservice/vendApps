using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Hubs;

namespace Petshop.Api.Services.Scale.Jobs;

/// <summary>
/// Envia a lista de produtos com peso para o dispositivo de balança informado via SignalR.
/// Chamado via Hangfire (fire-and-forget) ou diretamente do controller de sync.
/// </summary>
public class ScaleProductSyncJob
{
    private readonly AppDbContext               _db;
    private readonly IHubContext<ScaleAgentHub> _hub;

    public ScaleProductSyncJob(AppDbContext db, IHubContext<ScaleAgentHub> hub)
    {
        _db  = db;
        _hub = hub;
    }

    public async Task RunAsync(Guid deviceId, CancellationToken ct = default)
    {
        var device = await _db.ScaleDevices
            .Include(d => d.Agent)
            .FirstOrDefaultAsync(d => d.Id == deviceId, ct);

        if (device == null || !device.IsActive) return;

        var companyId = device.Agent.CompanyId;
        var agentId   = device.AgentId;

        // Carrega todos os produtos vendidos por peso com código de balança cadastrado
        var products = await _db.Products
            .Where(p => p.CompanyId       == companyId
                     && p.IsSoldByWeight
                     && p.ScaleProductCode != null
                     && p.IsActive)
            .Select(p => new ScaleProductPayload(
                p.ScaleProductCode!,
                p.Name,
                p.PriceCents,
                p.ScaleBarcodeMode.ToString()))
            .ToListAsync(ct);

        // Envia comando "SyncProducts" ao agente responsável
        await _hub.Clients
            .Group(ScaleAgentHub.GroupName(agentId))
            .SendAsync("SyncProducts", deviceId.ToString(), products, cancellationToken: ct);

        device.LastSyncUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

/// <summary>Payload enviado para o agente para programar um produto na balança.</summary>
public record ScaleProductPayload(
    string ScaleProductCode,
    string Name,
    int    PricePerKgCents,
    string BarcodeMode       // "WeightEncoded" | "PriceEncoded"
);
