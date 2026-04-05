using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Accounting;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Pdv;

namespace Petshop.Api.Services.Accounting;

public sealed class AccountingDataCollectorService
{
    private readonly AppDbContext _db;

    public AccountingDataCollectorService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AccountingDispatchDataset> CollectAsync(
        Guid companyId,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        AccountingDispatchConfig config,
        CancellationToken ct)
    {
        var completedOrders = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId
                     && o.Status == SaleOrderStatus.Completed
                     && o.CompletedAtUtc != null
                     && o.CompletedAtUtc >= periodStartUtc
                     && o.CompletedAtUtc < periodEndUtc)
            .Select(o => new SaleOrderDigest(
                o.Id,
                o.PublicId,
                o.CompletedAtUtc!.Value,
                o.CustomerName,
                o.CustomerPhone,
                o.CustomerDocument,
                o.SubtotalCents / 100m,
                o.DiscountCents / 100m,
                o.TotalCents / 100m))
            .ToListAsync(ct);

        var completedOrderIds = completedOrders.Select(o => o.Id).ToList();

        var paymentRows = await _db.SalePayments
            .AsNoTracking()
            .Where(p => completedOrderIds.Contains(p.SaleOrderId))
            .Select(p => new { p.SaleOrderId, p.PaymentMethod, Amount = p.AmountCents / 100m })
            .ToListAsync(ct);

        var paymentBreakdown = paymentRows
            .GroupBy(x => x.PaymentMethod)
            .Select(g => new PaymentBreakdownRow(g.Key, g.Sum(x => x.Amount), g.Count()))
            .OrderByDescending(x => x.TotalAmount)
            .ToList();

        var cancelledCount = await _db.SaleOrders
            .AsNoTracking()
            .CountAsync(o => o.CompanyId == companyId
                             && (o.Status == SaleOrderStatus.Cancelled || o.Status == SaleOrderStatus.Voided)
                             && ((o.CancelledAtUtc != null && o.CancelledAtUtc >= periodStartUtc && o.CancelledAtUtc < periodEndUtc)
                                 || (o.CancelledAtUtc == null && o.CreatedAtUtc >= periodStartUtc && o.CreatedAtUtc < periodEndUtc)),
                        ct);

        var fiscalDocsBase = _db.FiscalDocuments
            .AsNoTracking()
            .Where(d => d.CompanyId == companyId
                     && d.CreatedAtUtc >= periodStartUtc
                     && d.CreatedAtUtc < periodEndUtc
                     && d.XmlContent != null);

        var fiscalIssued = await fiscalDocsBase
            .Where(d => d.FiscalStatus == FiscalDocumentStatus.Authorized
                        || d.FiscalStatus == FiscalDocumentStatus.Contingency)
            .Select(d => new FiscalXmlRow(
                d.Id,
                d.AccessKey,
                d.Number,
                d.Serie,
                d.FiscalStatus,
                d.CreatedAtUtc,
                d.XmlContent!))
            .ToListAsync(ct);

        var fiscalCanceled = config.IncludeXmlCanceled
            ? await fiscalDocsBase
                .Where(d => d.FiscalStatus == FiscalDocumentStatus.Cancelled)
                .Select(d => new FiscalXmlRow(
                    d.Id,
                    d.AccessKey,
                    d.Number,
                    d.Serie,
                    d.FiscalStatus,
                    d.CreatedAtUtc,
                    d.XmlContent!))
                .ToListAsync(ct)
            : [];

        var gross = completedOrders.Sum(x => x.SubtotalAmount);
        var discount = completedOrders.Sum(x => x.DiscountAmount);
        var net = completedOrders.Sum(x => x.NetAmount);
        var avgTicket = completedOrders.Count > 0 ? decimal.Round(net / completedOrders.Count, 2) : 0m;

        var salesRows = completedOrders.Select(o =>
        {
            var method = paymentRows
                .Where(p => p.SaleOrderId == o.Id)
                .Select(p => p.PaymentMethod)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new SalesDetailRow(
                o.Id,
                o.PublicId,
                o.CompletedAtUtc,
                string.IsNullOrWhiteSpace(o.CustomerName) ? null : o.CustomerName,
                o.CustomerPhone,
                o.CustomerDocument,
                o.SubtotalAmount,
                o.DiscountAmount,
                o.NetAmount,
                method.Count == 0 ? "-" : string.Join(" | ", method),
                "Completed",
                "PDV");
        }).ToList();

        return new AccountingDispatchDataset(
            periodStartUtc,
            periodEndUtc,
            salesRows,
            paymentBreakdown,
            fiscalIssued,
            fiscalCanceled,
            completedOrders.Count,
            cancelledCount,
            gross,
            discount,
            net,
            avgTicket);
    }
}

public sealed record AccountingDispatchDataset(
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    IReadOnlyList<SalesDetailRow> SalesRows,
    IReadOnlyList<PaymentBreakdownRow> PaymentBreakdown,
    IReadOnlyList<FiscalXmlRow> FiscalIssuedRows,
    IReadOnlyList<FiscalXmlRow> FiscalCanceledRows,
    int CompletedSalesCount,
    int CancelledSalesCount,
    decimal GrossAmount,
    decimal DiscountAmount,
    decimal NetAmount,
    decimal AverageTicket);

public sealed record SalesDetailRow(
    Guid SaleOrderId,
    string PublicId,
    DateTime CompletedAtUtc,
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerDocument,
    decimal GrossAmount,
    decimal DiscountAmount,
    decimal NetAmount,
    string PaymentMethod,
    string Status,
    string Channel);

public sealed record PaymentBreakdownRow(string Method, decimal TotalAmount, int Count);

public sealed record FiscalXmlRow(
    Guid FiscalDocumentId,
    string? AccessKey,
    int Number,
    short Serie,
    FiscalDocumentStatus Status,
    DateTime CreatedAtUtc,
    string XmlContent);

public sealed record SaleOrderDigest(
    Guid Id,
    string PublicId,
    DateTime CompletedAtUtc,
    string CustomerName,
    string? CustomerPhone,
    string? CustomerDocument,
    decimal SubtotalAmount,
    decimal DiscountAmount,
    decimal NetAmount);
