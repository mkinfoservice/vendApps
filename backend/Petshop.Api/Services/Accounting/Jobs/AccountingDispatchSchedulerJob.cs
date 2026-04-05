namespace Petshop.Api.Services.Accounting.Jobs;

/// <summary>
/// Job recorrente do Hangfire que processa periodos contabilmente vencidos por tenant.
/// </summary>
public sealed class AccountingDispatchSchedulerJob
{
    private readonly AccountingDispatchService _dispatch;
    private readonly ILogger<AccountingDispatchSchedulerJob> _logger;

    public AccountingDispatchSchedulerJob(
        AccountingDispatchService dispatch,
        ILogger<AccountingDispatchSchedulerJob> logger)
    {
        _dispatch = dispatch;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        var processed = await _dispatch.ProcessDueDispatchesAsync(ct);
        _logger.LogInformation("ACCOUNTING_DISPATCH_SCAN_DONE | processed={Count}", processed);
    }
}
