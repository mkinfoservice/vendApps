using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Dav;

namespace Petshop.Api.Services.Dav.Jobs;

/// <summary>
/// Job Hangfire recorrente (diário): arquiva automaticamente DAVs em Draft
/// que não tiveram movimentação por mais de 24 horas.
///
/// Regras de segurança — NÃO arquiva:
/// - DAVs com FiscalDocumentId (fiscal em andamento)
/// - DAVs com SaleOrderId (já convertidos)
/// - DAVs com status ≠ Draft
/// - DAVs já arquivados
/// </summary>
public class DavAbandonmentJob
{
    private readonly AppDbContext               _db;
    private readonly ILogger<DavAbandonmentJob> _logger;

    // Tempo mínimo antes de considerar o DAV abandonado.
    // Pode ser configurado via appsettings no futuro.
    private const int DefaultAbandonAfterHours = 24;

    public DavAbandonmentJob(AppDbContext db, ILogger<DavAbandonmentJob> logger)
    {
        _db     = db;
        _logger = logger;
    }

    /// <summary>
    /// Executa o arquivamento em lote.
    /// Chamado pelo Hangfire via AddOrUpdateRecurringJob.
    /// </summary>
    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        var cutoff  = DateTime.UtcNow.AddHours(-DefaultAbandonAfterHours);
        var now     = DateTime.UtcNow;

        // Busca apenas DAVs seguros para arquivamento
        var toArchive = await _db.SalesQuotes
            .Where(s => !s.IsArchived
                     && s.Status == SalesQuoteStatus.Draft
                     && s.SaleOrderId == null
                     && s.FiscalDocumentId == null
                     && s.CreatedAtUtc < cutoff)
            .ToListAsync(ct);

        if (toArchive.Count == 0)
        {
            _logger.LogDebug("DavAbandonmentJob: nenhum DAV para arquivar.");
            return;
        }

        foreach (var dav in toArchive)
        {
            dav.IsArchived    = true;
            dav.ArchivedAtUtc = now;
            dav.UpdatedAtUtc  = now;
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "DavAbandonmentJob: {Count} DAV(s) arquivados (cutoff: {Cutoff:u}).",
            toArchive.Count, cutoff);
    }
}
