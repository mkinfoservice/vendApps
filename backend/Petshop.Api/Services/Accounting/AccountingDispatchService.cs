using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Petshop.Api.Data;
using Petshop.Api.Entities.Accounting;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Services.Tenancy;

namespace Petshop.Api.Services.Accounting;

public sealed class AccountingDispatchService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex EmailSeparatorRegex = new(@"[;,]", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly PlanFeatureService _features;
    private readonly AccountingDataCollectorService _collector;
    private readonly AccountingExportService _exports;
    private readonly AccountingEmailService _email;
    private readonly ILogger<AccountingDispatchService> _logger;

    public AccountingDispatchService(
        AppDbContext db,
        PlanFeatureService features,
        AccountingDataCollectorService collector,
        AccountingExportService exports,
        AccountingEmailService email,
        ILogger<AccountingDispatchService> logger)
    {
        _db = db;
        _features = features;
        _collector = collector;
        _exports = exports;
        _email = email;
        _logger = logger;
    }

    public async Task<AccountingDispatchConfig> GetOrCreateConfigAsync(Guid companyId, CancellationToken ct)
    {
        var cfg = await _db.AccountingDispatchConfigs
            .FirstOrDefaultAsync(x => x.CompanyId == companyId, ct);

        if (cfg is not null) return cfg;

        cfg = new AccountingDispatchConfig
        {
            CompanyId = companyId
        };

        _db.AccountingDispatchConfigs.Add(cfg);
        await _db.SaveChangesAsync(ct);
        return cfg;
    }

    public async Task<AccountingDispatchConfigDto> GetConfigDtoAsync(Guid companyId, CancellationToken ct)
    {
        var cfg = await GetOrCreateConfigAsync(companyId, ct);
        return ToDto(cfg);
    }

    public async Task<AccountingDispatchConfigDto> UpsertConfigAsync(
        Guid companyId,
        UpsertAccountingDispatchConfigRequest req,
        string updatedBy,
        CancellationToken ct)
    {
        var cfg = await GetOrCreateConfigAsync(companyId, ct);

        cfg.IsEnabled = req.IsEnabled;
        cfg.AccountantName = req.AccountantName?.Trim();
        cfg.PrimaryEmail = req.PrimaryEmail?.Trim();
        cfg.CcEmails = NormalizeCcEmails(req.CcEmails);
        cfg.Frequency = req.Frequency;
        cfg.DayOfMonth = Math.Clamp(req.DayOfMonth, 1, 28);
        cfg.DayOfWeek = Math.Clamp(req.DayOfWeek, 0, 6);
        cfg.SendTimeLocal = NormalizeTime(req.SendTimeLocal);
        cfg.TimezoneId = NormalizeTimezone(req.TimezoneId);
        cfg.IncludeXmlIssued = req.IncludeXmlIssued;
        cfg.IncludeXmlCanceled = req.IncludeXmlCanceled;
        cfg.IncludeSalesCsv = req.IncludeSalesCsv;
        cfg.IncludeSummaryPdf = req.IncludeSummaryPdf;
        cfg.MaxRetryCount = Math.Clamp(req.MaxRetryCount, 0, 5);
        cfg.RetryDelayMinutes = Math.Clamp(req.RetryDelayMinutes, 1, 120);
        cfg.FixedEmailNote = req.FixedEmailNote?.Trim();
        cfg.ProtectAttachments = req.ProtectAttachments;
        cfg.AttachmentPassword = string.IsNullOrWhiteSpace(req.AttachmentPassword)
            ? null
            : req.AttachmentPassword.Trim();
        cfg.MaxAttachmentSizeMb = Math.Clamp(req.MaxAttachmentSizeMb, 5, 30);
        cfg.SendWhenNoMovement = req.SendWhenNoMovement;
        cfg.UpdatedBy = updatedBy;
        cfg.UpdatedAtUtc = DateTime.UtcNow;

        ValidateConfig(cfg);
        await _db.SaveChangesAsync(ct);
        return ToDto(cfg);
    }

    public async Task<AccountingDispatchHistoryPageDto> GetHistoryAsync(
        Guid companyId,
        int page,
        int pageSize,
        string? status,
        CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _db.AccountingDispatchRuns
            .AsNoTracking()
            .Where(r => r.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<AccountingDispatchRunStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(r => r.Status == parsedStatus);
        }

        var total = await query.CountAsync(ct);
        var runs = await query
            .OrderByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new AccountingDispatchHistoryItemDto(
                r.Id,
                r.PeriodReference,
                r.PeriodStartUtc,
                r.PeriodEndUtc,
                r.TriggerType.ToString(),
                r.Status.ToString(),
                r.PrimaryRecipient,
                r.XmlCountIssued,
                r.XmlCountCanceled,
                r.SalesCount,
                r.GrossAmount,
                r.NetAmount,
                r.ErrorMessage,
                r.CreatedAtUtc,
                r.FinishedAtUtc))
            .ToListAsync(ct);

        return new AccountingDispatchHistoryPageDto(total, page, pageSize, runs);
    }

    public async Task<AccountingDispatchRunDetailDto?> GetRunDetailAsync(Guid companyId, Guid runId, CancellationToken ct)
    {
        var run = await _db.AccountingDispatchRuns
            .AsNoTracking()
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Id == runId, ct);

        if (run is null) return null;

        return new AccountingDispatchRunDetailDto(
            run.Id,
            run.PeriodReference,
            run.PeriodStartUtc,
            run.PeriodEndUtc,
            run.TriggerType.ToString(),
            run.Status.ToString(),
            run.CorrelationId,
            run.PrimaryRecipient,
            run.CcRecipients,
            run.XmlCountIssued,
            run.XmlCountCanceled,
            run.SalesCount,
            run.GrossAmount,
            run.DiscountAmount,
            run.CanceledAmount,
            run.NetAmount,
            run.AverageTicket,
            run.PaymentBreakdownJson,
            run.ErrorCode,
            run.ErrorMessage,
            run.StartedAtUtc,
            run.FinishedAtUtc,
            run.CreatedBy,
            run.Attachments
                .OrderBy(a => a.FileName)
                .Select(a => new AccountingDispatchAttachmentDto(
                    a.Id,
                    a.AttachmentType,
                    a.FileName,
                    a.SizeBytes,
                    a.ChecksumSha256,
                    a.CreatedAtUtc))
                .ToList());
    }

    public async Task<AccountingDispatchRunDetailDto> SendNowAsync(
        Guid companyId,
        SendNowRequest req,
        string requestedBy,
        CancellationToken ct)
    {
        var period = ResolveManualPeriod(req);
        var run = await DispatchAsync(
            companyId,
            period.StartUtc,
            period.EndUtc,
            period.PeriodReference,
            AccountingDispatchTriggerType.Manual,
            requestedBy,
            req.ForceResend,
            ct);

        return await GetRunDetailAsync(companyId, run.Id, ct)
            ?? throw new InvalidOperationException("Falha ao carregar historico da execucao.");
    }

    public async Task<AccountingDispatchRunDetailDto> RetryAsync(
        Guid companyId,
        Guid originalRunId,
        string requestedBy,
        CancellationToken ct)
    {
        var original = await _db.AccountingDispatchRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Id == originalRunId, ct)
            ?? throw new InvalidOperationException("Execucao nao encontrada.");

        var run = await DispatchAsync(
            companyId,
            original.PeriodStartUtc,
            original.PeriodEndUtc,
            original.PeriodReference,
            AccountingDispatchTriggerType.Retry,
            requestedBy,
            forceResend: true,
            ct);

        return await GetRunDetailAsync(companyId, run.Id, ct)
            ?? throw new InvalidOperationException("Falha ao carregar historico da execucao.");
    }

    public async Task TestEmailAsync(Guid companyId, string requestedBy, CancellationToken ct)
    {
        var cfg = await GetOrCreateConfigAsync(companyId, ct);
        var company = await LoadCompanyAsync(companyId, ct);
        await EnsureFeatureEnabledAsync(company, ct);

        if (string.IsNullOrWhiteSpace(cfg.PrimaryEmail))
            throw new InvalidOperationException("Configure o e-mail principal do contador antes de testar.");

        var body = string.Join(Environment.NewLine, [
            "Teste do modulo de envio contabil automatizado.",
            $"Empresa: {company.Name}",
            $"Solicitado por: {requestedBy}",
            $"Data UTC: {DateTime.UtcNow:dd/MM/yyyy HH:mm:ss}",
            "Se voce recebeu este e-mail, a configuracao SMTP esta valida."
        ]);

        await _email.SendTestAsync(cfg.PrimaryEmail, body, ct);
    }

    public async Task<int> ProcessDueDispatchesAsync(CancellationToken ct)
    {
        var nowUtc = DateTime.UtcNow;
        var enabledConfigs = await _db.AccountingDispatchConfigs
            .AsNoTracking()
            .Where(c => c.IsEnabled)
            .ToListAsync(ct);

        var processed = 0;
        foreach (var cfg in enabledConfigs)
        {
            try
            {
                var company = await _db.Companies
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == cfg.CompanyId && c.IsActive && !c.IsDeleted, ct);

                if (company is null)
                    continue;

                var features = await _features.ResolveFeaturesAsync(company, ct);
                if (!features.GetValueOrDefault(AppFeatureKeys.AccountingEmailDispatch, true))
                    continue;

                var due = IsDueNow(cfg, nowUtc);
                if (!due.IsDue)
                    continue;

                var existingSuccess = await _db.AccountingDispatchRuns
                    .AsNoTracking()
                    .AnyAsync(r =>
                        r.CompanyId == cfg.CompanyId
                        && r.PeriodReference == due.PeriodReference
                        && r.Status == AccountingDispatchRunStatus.Succeeded,
                        ct);

                if (existingSuccess)
                    continue;

                await DispatchAsync(
                    cfg.CompanyId,
                    due.PeriodStartUtc,
                    due.PeriodEndUtc,
                    due.PeriodReference,
                    AccountingDispatchTriggerType.Automatic,
                    "hangfire",
                    forceResend: false,
                    ct);

                processed++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "ACCOUNTING_DISPATCH_SCHEDULED_FAIL | companyId={CompanyId}",
                    cfg.CompanyId);
            }
        }

        return processed;
    }

    private async Task<AccountingDispatchRun> DispatchAsync(
        Guid companyId,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        string periodReference,
        AccountingDispatchTriggerType triggerType,
        string requestedBy,
        bool forceResend,
        CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        var cfg = await GetOrCreateConfigAsync(companyId, ct);
        await EnsureFeatureEnabledAsync(company, ct);

        if (triggerType != AccountingDispatchTriggerType.Test && !cfg.IsEnabled)
            throw new InvalidOperationException("Envio contabil automatico desabilitado para esta empresa.");

        ValidateConfig(cfg);

        var idempotencyKey = BuildIdempotencyKey(companyId, periodReference, triggerType, forceResend);

        if (!forceResend && triggerType == AccountingDispatchTriggerType.Automatic)
        {
            var existing = await _db.AccountingDispatchRuns
                .AsNoTracking()
                .Where(r => r.CompanyId == companyId
                            && r.IdempotencyKey == idempotencyKey)
                .OrderByDescending(r => r.CreatedAtUtc)
                .FirstOrDefaultAsync(ct);
            if (existing is not null)
            {
                _logger.LogInformation(
                    "ACCOUNTING_DISPATCH_IDEMPOTENT_HIT | companyId={CompanyId} period={Period} existingStatus={Status}",
                    companyId,
                    periodReference,
                    existing.Status);
                return existing;
            }
        }

        var correlationId = Guid.NewGuid().ToString("N");
        var run = new AccountingDispatchRun
        {
            CompanyId = companyId,
            PeriodStartUtc = periodStartUtc,
            PeriodEndUtc = periodEndUtc,
            PeriodReference = periodReference,
            TriggerType = triggerType,
            Status = AccountingDispatchRunStatus.Processing,
            CorrelationId = correlationId,
            IdempotencyKey = idempotencyKey,
            PrimaryRecipient = cfg.PrimaryEmail?.Trim(),
            CcRecipients = cfg.CcEmails,
            StartedAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedBy = requestedBy
        };

        _db.AccountingDispatchRuns.Add(run);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (!forceResend && IsUniqueIdempotencyViolation(ex))
        {
            var existing = await TryGetExistingRunByIdempotencyWithRetryAsync(companyId, idempotencyKey, ct);

            if (existing is not null)
                return existing;

            throw;
        }

        var stage = "collect";
        try
        {
            var dataset = await _collector.CollectAsync(
                companyId,
                periodStartUtc,
                periodEndUtc,
                cfg,
                ct);

            run.XmlCountIssued = dataset.FiscalIssuedRows.Count;
            run.XmlCountCanceled = dataset.FiscalCanceledRows.Count;
            run.SalesCount = dataset.CompletedSalesCount;
            run.GrossAmount = dataset.GrossAmount;
            run.DiscountAmount = dataset.DiscountAmount;
            run.CanceledAmount = dataset.CancelledSalesCount;
            run.NetAmount = dataset.NetAmount;
            run.AverageTicket = dataset.AverageTicket;
            run.PaymentBreakdownJson = JsonSerializer.Serialize(dataset.PaymentBreakdown, JsonOptions);

            var noMovement = dataset.CompletedSalesCount == 0
                             && dataset.FiscalIssuedRows.Count == 0
                             && dataset.FiscalCanceledRows.Count == 0;

            if (noMovement && cfg.SendWhenNoMovement == AccountingSendWhenNoMovement.Skip)
            {
                run.Status = AccountingDispatchRunStatus.Skipped;
                run.ErrorCode = "NO_MOVEMENT";
                run.ErrorMessage = "Periodo sem movimento. Marcado como skipped pela configuracao.";
                run.FinishedAtUtc = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
                return run;
            }

            var exportRequest = new AccountingExportRequest(
                periodReference,
                periodStartUtc,
                periodEndUtc,
                company.Name,
                await ResolveCompanyCnpjAsync(companyId, ct),
                dataset.FiscalIssuedRows,
                dataset.FiscalCanceledRows,
                dataset.SalesRows,
                dataset.PaymentBreakdown,
                dataset.CompletedSalesCount,
                dataset.CancelledSalesCount,
                dataset.GrossAmount,
                dataset.DiscountAmount,
                dataset.NetAmount,
                dataset.AverageTicket,
                cfg.IncludeXmlIssued || cfg.IncludeXmlCanceled,
                cfg.IncludeSalesCsv,
                cfg.IncludeSummaryPdf);

            stage = "export";
            var attachments = _exports.Generate(exportRequest);
            if (attachments.Count == 0)
                throw new InvalidOperationException("Nenhum anexo foi gerado. Ajuste os tipos de arquivo no painel.");

            if (cfg.ProtectAttachments)
            {
                if (string.IsNullOrWhiteSpace(cfg.AttachmentPassword))
                    throw new InvalidOperationException("Protecao de anexos ativada, mas nenhuma senha foi configurada.");

                attachments = EncryptAttachments(attachments, cfg.AttachmentPassword.Trim());
            }

            var totalAttachmentBytes = attachments.Sum(a => a.SizeBytes);
            var maxAttachmentBytes = Math.Max(cfg.MaxAttachmentSizeMb, 5) * 1024L * 1024L;
            if (totalAttachmentBytes > maxAttachmentBytes)
                throw new InvalidOperationException($"Total de anexos ({totalAttachmentBytes / 1024m / 1024m:N1} MB) excede o limite ({cfg.MaxAttachmentSizeMb} MB).");

            foreach (var item in attachments)
            {
                _db.AccountingDispatchAttachments.Add(new AccountingDispatchAttachment
                {
                    CompanyId = companyId,
                    RunId = run.Id,
                    AttachmentType = item.AttachmentType,
                    FileName = item.FileName,
                    SizeBytes = item.SizeBytes,
                    ChecksumSha256 = item.Sha256
                });
            }

            stage = "email";
            var (toEmail, ccEmails) = ResolveRecipients(cfg);
            var subject = $"[vendApps] Fechamento contabil {periodReference} - {company.Name}";
            var body = BuildEmailBody(company, cfg, periodReference, dataset);

            await _email.SendAsync(
                new AccountingEmailMessage(toEmail, ccEmails, subject, body),
                attachments,
                ct);

            run.Status = AccountingDispatchRunStatus.Succeeded;
            run.FinishedAtUtc = DateTime.UtcNow;
            cfg.LastSentAtUtc = run.FinishedAtUtc;
            cfg.LastSuccessAtUtc = run.FinishedAtUtc;

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "ACCOUNTING_DISPATCH_SUCCESS | companyId={CompanyId} runId={RunId} period={Period} trigger={Trigger}",
                companyId,
                run.Id,
                periodReference,
                triggerType);

            return run;
        }
        catch (Exception ex)
        {
            run.Status = stage == "email"
                ? AccountingDispatchRunStatus.PartialFailed
                : AccountingDispatchRunStatus.Failed;
            run.ErrorCode = "DISPATCH_FAILED";
            run.ErrorMessage = $"[{stage}] {ex.Message}";
            run.FinishedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            _logger.LogWarning(ex,
                "ACCOUNTING_DISPATCH_FAILED | companyId={CompanyId} runId={RunId} period={Period} trigger={Trigger}",
                companyId,
                run.Id,
                periodReference,
                triggerType);

            return run;
        }
    }

    private async Task<Company> LoadCompanyAsync(Guid companyId, CancellationToken ct)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId && c.IsActive && !c.IsDeleted, ct);
        return company ?? throw new InvalidOperationException("Empresa nao encontrada ou inativa.");
    }

    private async Task EnsureFeatureEnabledAsync(Company company, CancellationToken ct)
    {
        var features = await _features.ResolveFeaturesAsync(company, ct);
        if (!features.GetValueOrDefault(AppFeatureKeys.AccountingEmailDispatch, true))
            throw new InvalidOperationException("Feature accounting_email_dispatch nao habilitada para este tenant.");
    }

    private static void ValidateConfig(AccountingDispatchConfig cfg)
    {
        if (string.IsNullOrWhiteSpace(cfg.PrimaryEmail))
            throw new InvalidOperationException("E-mail principal do contador e obrigatorio.");

        _ = new System.Net.Mail.MailAddress(cfg.PrimaryEmail);
        foreach (var cc in SplitEmails(cfg.CcEmails))
            _ = new System.Net.Mail.MailAddress(cc);

        cfg.SendTimeLocal = NormalizeTime(cfg.SendTimeLocal);
        cfg.DayOfMonth = Math.Clamp(cfg.DayOfMonth, 1, 28);
        cfg.DayOfWeek = Math.Clamp(cfg.DayOfWeek, 0, 6);
        cfg.TimezoneId = NormalizeTimezone(cfg.TimezoneId);
    }

    private static (string Primary, List<string> Cc) ResolveRecipients(AccountingDispatchConfig cfg)
    {
        var primary = cfg.PrimaryEmail!.Trim();
        var cc = SplitEmails(cfg.CcEmails)
            .Where(x => !string.Equals(x, primary, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return (primary, cc);
    }

    private static string BuildEmailBody(
        Company company,
        AccountingDispatchConfig cfg,
        string periodReference,
        AccountingDispatchDataset dataset)
    {
        var lines = new List<string>
        {
            $"Ola {cfg.AccountantName ?? "contador(a)"},",
            "",
            $"Segue o fechamento contabil do periodo {periodReference} da empresa {company.Name}.",
            "",
            $"Vendas concluidas: {dataset.CompletedSalesCount}",
            $"Faturamento bruto: {ToBrl(dataset.GrossAmount)}",
            $"Descontos: {ToBrl(dataset.DiscountAmount)}",
            $"Total liquido: {ToBrl(dataset.NetAmount)}",
            $"XML emitidos: {dataset.FiscalIssuedRows.Count}",
            $"XML cancelados: {dataset.FiscalCanceledRows.Count}",
            "",
            "Arquivos anexados no envio.",
            "",
            "Mensagem automatica do vendApps."
        };

        if (!string.IsNullOrWhiteSpace(cfg.FixedEmailNote))
        {
            lines.Add("");
            lines.Add("Observacao da empresa:");
            lines.Add(cfg.FixedEmailNote.Trim());
        }

        if (cfg.ProtectAttachments)
        {
            lines.Add("");
            lines.Add("Atencao: anexos enviados com criptografia e senha.");
            lines.Add("Para abrir, use a senha informada pelo responsavel da empresa.");
        }

        return string.Join(Environment.NewLine, lines);
    }

    private static string ToBrl(decimal value) =>
        $"R$ {value:N2}".Replace(",", "X").Replace(".", ",").Replace("X", ".");

    private static string BuildIdempotencyKey(
        Guid companyId,
        string periodReference,
        AccountingDispatchTriggerType triggerType,
        bool forceResend)
    {
        if (forceResend)
            return $"force:{triggerType}:{periodReference}:{Guid.NewGuid():N}";

        return triggerType == AccountingDispatchTriggerType.Automatic
            ? $"auto:{companyId:N}:{periodReference}"
            : $"manual:{triggerType}:{companyId:N}:{periodReference}:{DateTime.UtcNow:yyyyMMddHHmmssfffffff}";
    }

    private static bool IsUniqueIdempotencyViolation(DbUpdateException ex)
    {
        if (ex.InnerException is not PostgresException pg)
            return false;

        return pg.SqlState == "23505"
               && string.Equals(pg.ConstraintName, "IX_AccountingDispatchRuns_CompanyId_IdempotencyKey", StringComparison.Ordinal);
    }

    private async Task<AccountingDispatchRun?> TryGetExistingRunByIdempotencyWithRetryAsync(
        Guid companyId,
        string idempotencyKey,
        CancellationToken ct)
    {
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var run = await _db.AccountingDispatchRuns
                .AsNoTracking()
                .Where(r => r.CompanyId == companyId && r.IdempotencyKey == idempotencyKey)
                .OrderByDescending(r => r.CreatedAtUtc)
                .FirstOrDefaultAsync(ct);

            if (run is not null)
                return run;

            await Task.Delay(120, ct);
        }

        return null;
    }

    private static string NormalizeCcEmails(string? raw)
    {
        var emails = SplitEmails(raw)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return emails.Count == 0 ? string.Empty : string.Join(";", emails);
    }

    private static IEnumerable<string> SplitEmails(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return [];

        return EmailSeparatorRegex
            .Split(raw)
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x));
    }

    private static string NormalizeTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "09:00";

        return TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
            ? time.ToString("HH:mm", CultureInfo.InvariantCulture)
            : "09:00";
    }

    private static string NormalizeTimezone(string? timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
            return "America/Sao_Paulo";

        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(timezone.Trim());
            return timezone.Trim();
        }
        catch
        {
            return "America/Sao_Paulo";
        }
    }

    private static (DateTime StartUtc, DateTime EndUtc, string PeriodReference) ResolveManualPeriod(SendNowRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.PeriodReference))
        {
            if (!DateOnly.TryParseExact(req.PeriodReference.Trim() + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var monthStart))
                throw new InvalidOperationException("periodReference deve estar no formato yyyy-MM.");

            var start = monthStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddMonths(1);
            return (start, end, monthStart.ToString("yyyy-MM", CultureInfo.InvariantCulture));
        }

        if (req.PeriodStartUtc is null || req.PeriodEndUtc is null)
            throw new InvalidOperationException("Informe periodReference ou periodStartUtc + periodEndUtc.");

        var startUtc = DateTime.SpecifyKind(req.PeriodStartUtc.Value, DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(req.PeriodEndUtc.Value, DateTimeKind.Utc);
        if (endUtc <= startUtc)
            throw new InvalidOperationException("periodEndUtc precisa ser maior que periodStartUtc.");

        var periodReference = $"{startUtc:yyyyMMdd}-{endUtc:yyyyMMdd}";
        return (startUtc, endUtc, periodReference);
    }

    private static DuePeriod IsDueNow(AccountingDispatchConfig cfg, DateTime nowUtc)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(NormalizeTimezone(cfg.TimezoneId));
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
        var sendTime = TimeOnly.ParseExact(NormalizeTime(cfg.SendTimeLocal), "HH:mm", CultureInfo.InvariantCulture);

        return cfg.Frequency switch
        {
            AccountingDispatchFrequency.Daily => ResolveDaily(cfg, localNow, sendTime, tz),
            AccountingDispatchFrequency.Weekly => ResolveWeekly(cfg, localNow, sendTime, tz),
            AccountingDispatchFrequency.Monthly => ResolveMonthly(cfg, localNow, sendTime, tz),
            _ => new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "")
        };
    }

    private static DuePeriod ResolveDaily(AccountingDispatchConfig cfg, DateTime localNow, TimeOnly sendTime, TimeZoneInfo tz)
    {
        var scheduledToday = localNow.Date.Add(sendTime.ToTimeSpan());
        if (localNow < scheduledToday)
            return new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "");

        var periodLocalStart = localNow.Date.AddDays(-1);
        var periodLocalEnd = localNow.Date;
        return ToDuePeriod(periodLocalStart, periodLocalEnd, "yyyy-MM-dd", tz);
    }

    private static DuePeriod ResolveWeekly(AccountingDispatchConfig cfg, DateTime localNow, TimeOnly sendTime, TimeZoneInfo tz)
    {
        if ((int)localNow.DayOfWeek != cfg.DayOfWeek)
            return new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "");
        if (localNow.TimeOfDay < sendTime.ToTimeSpan())
            return new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "");

        var periodLocalEnd = localNow.Date;
        var periodLocalStart = periodLocalEnd.AddDays(-7);
        return ToDuePeriod(periodLocalStart, periodLocalEnd, "yyyy-MM-dd", tz);
    }

    private static DuePeriod ResolveMonthly(AccountingDispatchConfig cfg, DateTime localNow, TimeOnly sendTime, TimeZoneInfo tz)
    {
        if (localNow.Day != cfg.DayOfMonth)
            return new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "");
        if (localNow.TimeOfDay < sendTime.ToTimeSpan())
            return new DuePeriod(false, DateTime.MinValue, DateTime.MinValue, "");

        var thisMonthStart = new DateTime(localNow.Year, localNow.Month, 1);
        var periodLocalEnd = thisMonthStart;
        var periodLocalStart = thisMonthStart.AddMonths(-1);
        return ToDuePeriod(periodLocalStart, periodLocalEnd, "yyyy-MM", tz);
    }

    private static DuePeriod ToDuePeriod(DateTime localStart, DateTime localEnd, string referencePattern, TimeZoneInfo tz)
    {
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localStart, DateTimeKind.Unspecified), tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localEnd, DateTimeKind.Unspecified), tz);
        var periodReference = localStart.ToString(referencePattern, CultureInfo.InvariantCulture);
        return new DuePeriod(true, startUtc, endUtc, periodReference);
    }

    private async Task<string> ResolveCompanyCnpjAsync(Guid companyId, CancellationToken ct)
    {
        var cnpj = await _db.FiscalConfigs
            .AsNoTracking()
            .Where(f => f.CompanyId == companyId)
            .Select(f => f.Cnpj)
            .FirstOrDefaultAsync(ct);
        return string.IsNullOrWhiteSpace(cnpj) ? "-" : cnpj;
    }

    private static List<GeneratedAttachment> EncryptAttachments(IReadOnlyList<GeneratedAttachment> original, string password)
    {
        return original.Select(item =>
        {
            var encrypted = EncryptBytes(item.Content, password);
            using var sha = SHA256.Create();
            var hash = Convert.ToHexString(sha.ComputeHash(encrypted)).ToLowerInvariant();
            return new GeneratedAttachment(
                item.AttachmentType,
                $"{item.FileName}.enc",
                encrypted,
                encrypted.LongLength,
                hash);
        }).ToList();
    }

    private static byte[] EncryptBytes(byte[] plain, string password)
    {
        Span<byte> salt = stackalloc byte[16];
        Span<byte> iv = stackalloc byte[16];
        RandomNumberGenerator.Fill(salt);
        RandomNumberGenerator.Fill(iv);

        using var derive = new Rfc2898DeriveBytes(password, salt.ToArray(), 120_000, HashAlgorithmName.SHA256);
        var key = derive.GetBytes(32);

        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Key = key;
        aes.IV = iv.ToArray();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var encryptor = aes.CreateEncryptor();
        using var cipherStream = new MemoryStream();
        using (var crypto = new CryptoStream(cipherStream, encryptor, CryptoStreamMode.Write))
        {
            crypto.Write(plain, 0, plain.Length);
            crypto.FlushFinalBlock();
        }

        using var payload = new MemoryStream();
        var magic = Encoding.ASCII.GetBytes("VENDAPPS1");
        payload.Write(magic, 0, magic.Length);
        payload.Write(salt);
        payload.Write(iv);
        payload.Write(cipherStream.ToArray());
        return payload.ToArray();
    }

    private static AccountingDispatchConfigDto ToDto(AccountingDispatchConfig cfg) =>
        new(
            cfg.IsEnabled,
            cfg.AccountantName,
            cfg.PrimaryEmail,
            cfg.CcEmails ?? "",
            cfg.Frequency,
            cfg.DayOfMonth,
            cfg.DayOfWeek,
            cfg.SendTimeLocal,
            cfg.TimezoneId,
            cfg.IncludeXmlIssued,
            cfg.IncludeXmlCanceled,
            cfg.IncludeSalesCsv,
            cfg.IncludeSummaryPdf,
            cfg.MaxRetryCount,
            cfg.RetryDelayMinutes,
            cfg.FixedEmailNote,
            cfg.ProtectAttachments,
            null,
            cfg.MaxAttachmentSizeMb,
            cfg.SendWhenNoMovement,
            cfg.LastSentAtUtc,
            cfg.LastSuccessAtUtc,
            cfg.UpdatedAtUtc);
}

public sealed record UpsertAccountingDispatchConfigRequest(
    bool IsEnabled,
    string? AccountantName,
    string? PrimaryEmail,
    string? CcEmails,
    AccountingDispatchFrequency Frequency,
    int DayOfMonth,
    int DayOfWeek,
    string SendTimeLocal,
    string TimezoneId,
    bool IncludeXmlIssued,
    bool IncludeXmlCanceled,
    bool IncludeSalesCsv,
    bool IncludeSummaryPdf,
    int MaxRetryCount,
    int RetryDelayMinutes,
    string? FixedEmailNote,
    bool ProtectAttachments,
    string? AttachmentPassword,
    int MaxAttachmentSizeMb,
    AccountingSendWhenNoMovement SendWhenNoMovement);

public sealed record AccountingDispatchConfigDto(
    bool IsEnabled,
    string? AccountantName,
    string? PrimaryEmail,
    string CcEmails,
    AccountingDispatchFrequency Frequency,
    int DayOfMonth,
    int DayOfWeek,
    string SendTimeLocal,
    string TimezoneId,
    bool IncludeXmlIssued,
    bool IncludeXmlCanceled,
    bool IncludeSalesCsv,
    bool IncludeSummaryPdf,
    int MaxRetryCount,
    int RetryDelayMinutes,
    string? FixedEmailNote,
    bool ProtectAttachments,
    string? AttachmentPassword,
    int MaxAttachmentSizeMb,
    AccountingSendWhenNoMovement SendWhenNoMovement,
    DateTime? LastSentAtUtc,
    DateTime? LastSuccessAtUtc,
    DateTime UpdatedAtUtc);

public sealed record AccountingDispatchHistoryItemDto(
    Guid Id,
    string PeriodReference,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string TriggerType,
    string Status,
    string? PrimaryRecipient,
    int XmlCountIssued,
    int XmlCountCanceled,
    int SalesCount,
    decimal GrossAmount,
    decimal NetAmount,
    string? ErrorMessage,
    DateTime CreatedAtUtc,
    DateTime? FinishedAtUtc);

public sealed record AccountingDispatchHistoryPageDto(
    int Total,
    int Page,
    int PageSize,
    IReadOnlyList<AccountingDispatchHistoryItemDto> Items);

public sealed record AccountingDispatchAttachmentDto(
    Guid Id,
    string AttachmentType,
    string FileName,
    long SizeBytes,
    string ChecksumSha256,
    DateTime CreatedAtUtc);

public sealed record AccountingDispatchRunDetailDto(
    Guid Id,
    string PeriodReference,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string TriggerType,
    string Status,
    string CorrelationId,
    string? PrimaryRecipient,
    string? CcRecipients,
    int XmlCountIssued,
    int XmlCountCanceled,
    int SalesCount,
    decimal GrossAmount,
    decimal DiscountAmount,
    decimal CanceledAmount,
    decimal NetAmount,
    decimal AverageTicket,
    string PaymentBreakdownJson,
    string? ErrorCode,
    string? ErrorMessage,
    DateTime StartedAtUtc,
    DateTime? FinishedAtUtc,
    string? CreatedBy,
    IReadOnlyList<AccountingDispatchAttachmentDto> Attachments);

public sealed record SendNowRequest(
    string? PeriodReference,
    DateTime? PeriodStartUtc,
    DateTime? PeriodEndUtc,
    bool ForceResend = false);

public static class AccountingDispatchClaims
{
    public static Guid GetCompanyId(ClaimsPrincipal user)
        => Guid.Parse(user.FindFirstValue("companyId")!);

    public static string GetActor(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Name) ?? "system";
}

public sealed record DuePeriod(
    bool IsDue,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string PeriodReference);
