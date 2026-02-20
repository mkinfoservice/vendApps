using Cronos;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Job Hangfire que executa a cada minuto e verifica quais ExternalSources
/// com SyncMode=Scheduled têm cron vencido. Dispara delta sync automaticamente.
/// Registrado em Program.cs: RecurringJob.AddOrUpdate&lt;SyncSchedulerJob&gt;(..., "* * * * *")
/// </summary>
public class SyncSchedulerJob
{
    private readonly AppDbContext _db;
    private readonly ProductSyncService _syncService;
    private readonly ILogger<SyncSchedulerJob> _logger;

    public SyncSchedulerJob(AppDbContext db, ProductSyncService syncService, ILogger<SyncSchedulerJob> logger)
    {
        _db = db;
        _syncService = syncService;
        _logger = logger;
    }

    public async Task RunScheduledSyncsAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var sources = await _db.ExternalSources
            .Where(s => s.IsActive && s.SyncMode == SyncMode.Scheduled && s.ScheduleCron != null)
            .ToListAsync(ct);

        foreach (var source in sources)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var cron = CronExpression.Parse(source.ScheduleCron!);
                var lastSync = source.LastSyncAtUtc ?? DateTime.MinValue;
                var next = cron.GetNextOccurrence(lastSync, TimeZoneInfo.Utc);

                if (next == null || next.Value > now)
                    continue;

                _logger.LogInformation("Disparando sync agendado para fonte {SourceId} ({Name})", source.Id, source.Name);

                await _syncService.RunAsync(
                    source.CompanyId, source.Id,
                    SyncType.Delta, source.LastSyncAtUtc,
                    100, SyncTriggeredBy.Scheduler, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar sync agendado para fonte {SourceId}", source.Id);
            }
        }
    }
}
