using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Pdv;

namespace Petshop.Api.Services.Fiscal.Jobs;

/// <summary>
/// Processa itens da fila fiscal: constrói FiscalDocumentRequest,
/// chama o motor fiscal, persiste FiscalDocument e grava auditoria.
/// </summary>
public class FiscalQueueProcessorJob
{
    private readonly AppDbContext                     _db;
    private readonly IFiscalEngine                    _fiscalEngine;
    private readonly RealFiscalEngine                 _realEngine;
    private readonly NfceNumberService                _numberSvc;
    private readonly ILogger<FiscalQueueProcessorJob> _logger;

    private const int BatchSize = 50;
    private const int MaxRetries = 5;

    public FiscalQueueProcessorJob(
        AppDbContext db,
        IFiscalEngine fiscalEngine,
        RealFiscalEngine realEngine,
        NfceNumberService numberSvc,
        ILogger<FiscalQueueProcessorJob> logger)
    {
        _db           = db;
        _fiscalEngine = fiscalEngine;
        _realEngine   = realEngine;
        _numberSvc    = numberSvc;
        _logger       = logger;
    }

    public async Task ProcessAsync(Guid companyId, CancellationToken ct = default)
    {
        var items = await _db.FiscalQueues
            .Where(q => q.CompanyId == companyId
                     && q.Status == FiscalQueueStatus.Waiting
                     && q.RetryCount < MaxRetries
                     && (q.ScheduledForUtc == null || q.ScheduledForUtc <= DateTime.UtcNow))
            .OrderByDescending(q => q.Priority)
            .ThenBy(q => q.CreatedAtUtc)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (items.Count == 0)
        {
            _logger.LogDebug("[FiscalQueue] Nenhum item aguardando para empresa {CompanyId}.", companyId);
            return;
        }

        _logger.LogInformation("[FiscalQueue] Processando {Count} itens para empresa {CompanyId}.",
            items.Count, companyId);

        // Fallback: config empresa (legado). Config por caixa é resolvida em ProcessItemAsync.
        var fallbackConfig = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == companyId && f.IsActive, ct);

        foreach (var item in items)
            await ProcessItemAsync(item, fallbackConfig, ct);
    }

    private async Task ProcessItemAsync(FiscalQueue item, FiscalConfig? fallbackConfig, CancellationToken ct)
    {
        // Atomic claim: só avança se o item ainda está Waiting neste momento.
        // Previne que múltiplos workers do Hangfire processem o mesmo item em paralelo.
        var now = DateTime.UtcNow;
        var claimed = await _db.Database.ExecuteSqlAsync(
            $"""
            UPDATE "FiscalQueues"
            SET    "Status"         = 'Processing',
                   "RetryCount"     = "RetryCount" + 1,
                   "ProcessedAtUtc" = {now}
            WHERE  "Id" = {item.Id} AND "Status" = 'Waiting'
            """, ct);

        if (claimed == 0)
        {
            _logger.LogDebug("[FiscalQueue] Item {Id} já reclamado por outro worker. Ignorando.", item.Id);
            return;
        }

        // Recarrega item do banco para ter instância limpa no EF tracker
        // (a instância anterior foi carregada antes do UPDATE atômico)
        item = (await _db.FiscalQueues.FindAsync(new object[] { item.Id }, ct))!;

        try
        {
            var sale = await _db.SaleOrders
                .Include(o => o.Items)
                .Include(o => o.Payments)
                .FirstOrDefaultAsync(o => o.Id == item.SaleOrderId, ct);

            if (sale == null)
            {
                item.Status = FiscalQueueStatus.Skipped;
                item.FailureReason = "SaleOrder não encontrada.";
                await _db.SaveChangesAsync(ct);
                return;
            }

            // Resolve config fiscal: prefere config por caixa, fallback para config empresa (legado)
            CashRegisterFiscalConfig? registerConfig = null;
            if (sale.CashRegisterId != Guid.Empty)
            {
                registerConfig = await _db.CashRegisterFiscalConfigs
                    .FirstOrDefaultAsync(c => c.CashRegisterId == sale.CashRegisterId && c.IsActive, ct);
            }

            // Extrai dados do emitter da fonte disponível
            string? certBase64, certPassword, certPath;
            EmitterData emitter;
            short nfceSerie;

            if (registerConfig != null)
            {
                emitter      = BuildEmitter(registerConfig);
                certBase64   = registerConfig.CertificateBase64;
                certPassword = registerConfig.CertificatePassword;
                certPath     = null;
                nfceSerie    = registerConfig.NfceSerie;
            }
            else if (fallbackConfig != null)
            {
                emitter      = BuildEmitter(fallbackConfig);
                certBase64   = fallbackConfig.CertificateBase64;
                certPassword = fallbackConfig.CertificatePassword;
                certPath     = fallbackConfig.CertificatePath;
                nfceSerie    = fallbackConfig.NfceSerie;
            }
            else
            {
                _logger.LogWarning("[FiscalQueue] Nenhuma FiscalConfig para caixa/empresa {Co}. Item mantido em espera.", item.CompanyId);
                item.Status     = FiscalQueueStatus.Waiting;
                item.RetryCount--;
                await _db.SaveChangesAsync(ct);
                return;
            }

            // Idempotência: se já autorizada, apenas completa a fila
            if (sale.FiscalDocumentId.HasValue)
            {
                var existing = await _db.FiscalDocuments.FindAsync(new object[] { sale.FiscalDocumentId.Value }, ct);
                if (existing?.FiscalStatus == FiscalDocumentStatus.Authorized)
                {
                    item.Status          = FiscalQueueStatus.Completed;
                    item.FiscalDocumentId = existing.Id;
                    await _db.SaveChangesAsync(ct);
                    return;
                }
            }

            // Reserva número sequencial (atômico via upsert PostgreSQL)
            var serie  = nfceSerie;
            var number = await _numberSvc.GetNextNumberAsync(item.CompanyId, serie);

            var fiscalDoc = new FiscalDocument
            {
                CompanyId    = item.CompanyId,
                SaleOrderId  = sale.Id,
                DocumentType = FiscalDocumentType.NFCe,
                Serie        = serie,
                Number       = number,
                FiscalStatus = FiscalDocumentStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.FiscalDocuments.Add(fiscalDoc);

            sale.FiscalDocumentId = fiscalDoc.Id;
            await _db.SaveChangesAsync(ct); // persiste número ANTES de chamar SEFAZ

            // Carrega produtos para NCM e código
            var productIds = sale.Items.Select(i => i.ProductId).Distinct().ToList();
            var products   = await _db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            var defaultCfop = registerConfig?.DefaultCfop ?? fallbackConfig?.DefaultCfop ?? "5102";

            var fiscalItems = sale.Items.Select((i, idx) =>
            {
                var p = products.GetValueOrDefault(i.ProductId);
                return new FiscalItemData(
                    idx + 1,
                    p?.InternalCode ?? i.ProductId.ToString("N")[..5],
                    p?.Barcode ?? i.ProductBarcodeSnapshot ?? "",
                    i.ProductNameSnapshot,
                    p?.Ncm ?? "00000000",
                    defaultCfop,
                    i.IsSoldByWeight ? "KG" : (p?.Unit ?? "UN"),
                    i.IsSoldByWeight ? (decimal)(i.WeightKg ?? 0) : (decimal)i.Qty,
                    (decimal)i.UnitPriceCentsSnapshot,
                    (decimal)i.TotalCents,
                    i.IsSoldByWeight);
            }).ToList();

            var fiscalPayments = sale.Payments.Select(p =>
                new FiscalPaymentData(p.PaymentMethod, p.AmountCents, p.ChangeCents)).ToList();

            var contingType = sale.FiscalDecision == "Contingency"
                ? ContingencyType.SvcAn : ContingencyType.None;

            var req = new FiscalDocumentRequest
            {
                CompanyId        = item.CompanyId,
                SaleOrderId      = sale.Id,
                FiscalDocumentId = fiscalDoc.Id,
                DocumentType     = FiscalDocumentType.NFCe,
                Serie            = serie,
                Number           = number,
                SaleDateTimeUtc  = sale.CompletedAtUtc ?? sale.CreatedAtUtc,
                SubtotalCents    = sale.SubtotalCents,
                DiscountCents    = sale.DiscountCents,
                TotalCents       = sale.TotalCents,
                CustomerName     = sale.CustomerName,
                CustomerDocument = sale.CustomerDocument,
                ContingencyType  = contingType,
                Emitter          = emitter,
                Items            = fiscalItems,
                Payments         = fiscalPayments,
            };

            // Chama motor fiscal — prefere base64 (cloud-friendly), fallback para path (legado)
            FiscalEngineResult engineResult;
            if (!string.IsNullOrWhiteSpace(certBase64))
            {
                var certBytes = Convert.FromBase64String(certBase64);
                engineResult = await _realEngine.IssueWithCertAsync(req, certBytes, certPassword, ct);
            }
            else if (!string.IsNullOrWhiteSpace(certPath))
                engineResult = await _realEngine.IssueWithCertAsync(req, certPath, certPassword, ct);
            else
                engineResult = await _fiscalEngine.IssueAsync(req, ct);

            // Atualiza FiscalDocument
            fiscalDoc.TransmissionAttempts++;
            fiscalDoc.LastAttemptAtUtc = DateTime.UtcNow;
            fiscalDoc.UpdatedAtUtc     = DateTime.UtcNow;

            if (engineResult.Success)
            {
                fiscalDoc.FiscalStatus             = FiscalDocumentStatus.Authorized;
                fiscalDoc.AccessKey                = engineResult.AccessKey;
                fiscalDoc.AuthorizationCode        = engineResult.Protocol;
                fiscalDoc.AuthorizationDateTimeUtc = DateTime.UtcNow;
                fiscalDoc.XmlContent               = engineResult.XmlSigned;
                item.Status           = FiscalQueueStatus.Completed;
                item.FiscalDocumentId = fiscalDoc.Id;
            }
            else if (engineResult.Status == FiscalDocumentStatus.Contingency)
            {
                fiscalDoc.FiscalStatus    = FiscalDocumentStatus.Contingency;
                fiscalDoc.ContingencyType = contingType == ContingencyType.None ? ContingencyType.SvcAn : contingType;
                fiscalDoc.XmlContent      = engineResult.XmlSigned;
                item.Status              = FiscalQueueStatus.Waiting;
                item.ScheduledForUtc     = DateTime.UtcNow.AddMinutes(30);
                item.RetryCount--;
            }
            else
            {
                fiscalDoc.FiscalStatus  = FiscalDocumentStatus.Rejected;
                fiscalDoc.RejectCode    = engineResult.ErrorCode;
                fiscalDoc.RejectMessage = engineResult.ErrorMessage;
                item.Status             = item.RetryCount >= MaxRetries ? FiscalQueueStatus.Failed : FiscalQueueStatus.Waiting;
                item.FailureReason      = $"[{engineResult.ErrorCode}] {engineResult.ErrorMessage}";
            }

            _db.FiscalAuditLogs.Add(new FiscalAuditLog
            {
                CompanyId  = item.CompanyId,
                EntityType = "FiscalDocument",
                EntityId   = fiscalDoc.Id,
                Action     = engineResult.Success ? "Authorized" : (engineResult.Status == FiscalDocumentStatus.Contingency ? "Contingency" : "Rejected"),
                NewStatus  = fiscalDoc.FiscalStatus.ToString(),
                ActorType  = "Job",
                Details    = engineResult.Success
                    ? $"{{\"protocol\":\"{engineResult.Protocol}\",\"key\":\"{engineResult.AccessKey}\"}}"
                    : $"{{\"code\":\"{engineResult.ErrorCode}\",\"msg\":\"{engineResult.ErrorMessage}\"}}",
            });

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("[FiscalQueue] Item {Id} → {Status} | NFC-e #{Num} | Venda {SaleId}.",
                item.Id, fiscalDoc.FiscalStatus, number, sale.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FiscalQueue] Erro ao processar item {QueueId}.", item.Id);
            item.Status        = item.RetryCount >= MaxRetries ? FiscalQueueStatus.Failed : FiscalQueueStatus.Waiting;
            item.FailureReason = ex.Message;
            await _db.SaveChangesAsync(ct);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static EmitterData BuildEmitter(CashRegisterFiscalConfig c) => new(
        c.Cnpj, c.InscricaoEstadual, c.RazaoSocial, c.NomeFantasia, c.Uf,
        c.Logradouro, c.NumeroEndereco, c.Complemento, c.Bairro,
        c.CodigoMunicipio, c.NomeMunicipio, c.Cep, c.Telefone,
        c.DefaultCfop, c.CscId, c.CscToken, c.SefazEnvironment, c.TaxRegime);

    private static EmitterData BuildEmitter(FiscalConfig c) => new(
        c.Cnpj, c.InscricaoEstadual, c.RazaoSocial, c.NomeFantasia, c.Uf,
        c.Logradouro, c.NumeroEndereco, c.Complemento, c.Bairro,
        c.CodigoMunicipio, c.NomeMunicipio, c.Cep, c.Telefone,
        c.DefaultCfop, c.CscId, c.CscToken, c.SefazEnvironment, c.TaxRegime);
}
