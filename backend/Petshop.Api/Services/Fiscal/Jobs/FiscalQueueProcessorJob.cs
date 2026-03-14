using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;

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

        var fiscalConfig = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == companyId && f.IsActive, ct);

        foreach (var item in items)
            await ProcessItemAsync(item, fiscalConfig, ct);
    }

    private async Task ProcessItemAsync(FiscalQueue item, FiscalConfig? fiscalConfig, CancellationToken ct)
    {
        item.Status         = FiscalQueueStatus.Processing;
        item.RetryCount++;
        item.ProcessedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

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

            if (fiscalConfig == null)
            {
                _logger.LogWarning("[FiscalQueue] FiscalConfig ausente para {Co}. Item mantido em espera.", item.CompanyId);
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
            var serie  = fiscalConfig.NfceSerie;
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

            var emitter = new EmitterData(
                fiscalConfig.Cnpj, fiscalConfig.InscricaoEstadual, fiscalConfig.RazaoSocial,
                fiscalConfig.NomeFantasia, fiscalConfig.Uf, fiscalConfig.Logradouro,
                fiscalConfig.NumeroEndereco, fiscalConfig.Complemento, fiscalConfig.Bairro,
                fiscalConfig.CodigoMunicipio, fiscalConfig.NomeMunicipio, fiscalConfig.Cep,
                fiscalConfig.Telefone, fiscalConfig.DefaultCfop,
                fiscalConfig.CscId, fiscalConfig.CscToken,
                fiscalConfig.SefazEnvironment, fiscalConfig.TaxRegime);

            var fiscalItems = sale.Items.Select((i, idx) =>
            {
                var p = products.GetValueOrDefault(i.ProductId);
                return new FiscalItemData(
                    idx + 1,
                    p?.InternalCode ?? i.ProductId.ToString("N")[..5],
                    p?.Barcode ?? i.ProductBarcodeSnapshot ?? "",
                    i.ProductNameSnapshot,
                    p?.Ncm ?? "00000000",
                    fiscalConfig.DefaultCfop,
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
                ContingencyType  = contingType,
                Emitter          = emitter,
                Items            = fiscalItems,
                Payments         = fiscalPayments,
            };

            // Chama motor fiscal — prefere base64 (cloud-friendly), fallback para path (legado)
            FiscalEngineResult engineResult;
            if (!string.IsNullOrWhiteSpace(fiscalConfig.CertificateBase64))
            {
                var certBytes = Convert.FromBase64String(fiscalConfig.CertificateBase64);
                engineResult = await _realEngine.IssueWithCertAsync(req, certBytes, fiscalConfig.CertificatePassword, ct);
            }
            else if (!string.IsNullOrWhiteSpace(fiscalConfig.CertificatePath))
                engineResult = await _realEngine.IssueWithCertAsync(req, fiscalConfig.CertificatePath, fiscalConfig.CertificatePassword, ct);
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
}
