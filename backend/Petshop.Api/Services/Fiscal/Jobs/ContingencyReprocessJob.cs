using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal.Jobs;

/// <summary>
/// Job Hangfire recorrente: tenta reenviar ao SEFAZ documentos em contingência temporária.
///
/// Regras:
/// - Janela legal: até 48h após emissão em contingência (prazo da SEFAZ).
/// - Documentos em PermanentContingency NÃO são tocados por este job.
/// - Documentos com mais de 36h geram alerta de urgência nos logs.
/// - Documentos além de 48h são marcados como expirados e alertam o contador.
///
/// Fase atual (0): estrutura e alertas funcionais.
/// Fase 5: implementar reenvio real via AcbrFiscalEngine.
/// </summary>
public class ContingencyReprocessJob
{
    private readonly AppDbContext _db;
    private readonly IFiscalEngine _fiscalEngine;
    private readonly ILogger<ContingencyReprocessJob> _logger;

    private const int MaxContingencyHours = 48;
    private const int AlertThresholdHours = 36;
    private const int BatchSize = 100;

    public ContingencyReprocessJob(
        AppDbContext db,
        IFiscalEngine fiscalEngine,
        ILogger<ContingencyReprocessJob> logger)
    {
        _db = db;
        _fiscalEngine = fiscalEngine;
        _logger = logger;
    }

    /// <summary>
    /// Verifica e tenta reenviar documentos em contingência temporária.
    /// Executado a cada 5 minutos pelo Hangfire.
    /// </summary>
    public async Task RunAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var cutoff = now.AddHours(-MaxContingencyHours);

        var pending = await _db.FiscalDocuments
            .Where(d => d.FiscalStatus == FiscalDocumentStatus.Contingency
                     && d.ContingencyType != ContingencyType.None
                     && d.CreatedAtUtc >= cutoff)
            .OrderBy(d => d.CreatedAtUtc)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (pending.Count == 0)
        {
            _logger.LogDebug("[Contingência] Nenhum documento pendente de reenvio.");
            return;
        }

        _logger.LogInformation(
            "[Contingência] {Count} documento(s) aguardando reenvio ao SEFAZ.",
            pending.Count);

        // Separar por urgência para priorizar nos logs
        var expiring = pending
            .Where(d => d.CreatedAtUtc < now.AddHours(-AlertThresholdHours))
            .ToList();

        var normal = pending
            .Where(d => d.CreatedAtUtc >= now.AddHours(-AlertThresholdHours))
            .ToList();

        if (expiring.Count > 0)
        {
            _logger.LogWarning(
                "[Contingência] ALERTA: {Count} documento(s) com mais de {Hours}h em contingência! " +
                "Prazo legal de {Max}h se encerrando. Acione o contador.",
                expiring.Count, AlertThresholdHours, MaxContingencyHours);
        }

        // TODO (Fase 5): para cada documento, verificar se SEFAZ está online
        // e chamar _fiscalEngine.IssueAsync() com o XML em contingência
        foreach (var doc in pending)
        {
            _logger.LogDebug(
                "[Contingência] Doc {DocId} | empresa {CompanyId} | emitido em {Date} | " +
                "tipo {ContingencyType} — aguardando integração ACBr (Fase 5).",
                doc.Id, doc.CompanyId, doc.CreatedAtUtc, doc.ContingencyType);
        }

        // Documentos que ultrapassaram 48h: registrar como expirados
        var expired = await _db.FiscalDocuments
            .Where(d => d.FiscalStatus == FiscalDocumentStatus.Contingency
                     && d.ContingencyType != ContingencyType.None
                     && d.CreatedAtUtc < cutoff)
            .ToListAsync(ct);

        if (expired.Count > 0)
        {
            _logger.LogError(
                "[Contingência] CRÍTICO: {Count} documento(s) ultrapassaram o prazo de {Hours}h! " +
                "Regularização manual obrigatória. Contacte o contador imediatamente.",
                expired.Count, MaxContingencyHours);
        }
    }
}
