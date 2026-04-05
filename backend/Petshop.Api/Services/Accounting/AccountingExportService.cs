using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Petshop.Api.Services.Accounting;

public sealed class AccountingExportService
{
    public List<GeneratedAttachment> Generate(
        AccountingExportRequest req)
    {
        var list = new List<GeneratedAttachment>();

        if (req.IncludeXmls)
        {
            var xmlBytes = BuildXmlZip(req);
            list.Add(CreateAttachment(
                "XmlZip",
                $"xml-fiscais-{req.PeriodReference}.zip",
                xmlBytes));
        }

        if (req.IncludeSalesCsv)
        {
            var csvBytes = BuildSalesCsv(req);
            list.Add(CreateAttachment(
                "SalesCsv",
                $"vendas-detalhadas-{req.PeriodReference}.csv",
                csvBytes));
        }

        if (req.IncludeSummaryPdf)
        {
            var pdfBytes = BuildSummaryPdf(req);
            list.Add(CreateAttachment(
                "SummaryPdf",
                $"resumo-contabil-{req.PeriodReference}.pdf",
                pdfBytes));
        }

        return list;
    }

    private static byte[] BuildXmlZip(AccountingExportRequest req)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
        {
            foreach (var doc in req.FiscalIssuedRows)
            {
                var fileName = BuildFiscalFileName("emitida", doc.AccessKey, doc.Number, doc.Serie, doc.CreatedAtUtc);
                var entry = zip.CreateEntry(fileName, CompressionLevel.Optimal);
                using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
                writer.Write(doc.XmlContent);
            }

            foreach (var doc in req.FiscalCanceledRows)
            {
                var fileName = BuildFiscalFileName("cancelada", doc.AccessKey, doc.Number, doc.Serie, doc.CreatedAtUtc);
                var entry = zip.CreateEntry(fileName, CompressionLevel.Optimal);
                using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
                writer.Write(doc.XmlContent);
            }
        }

        return ms.ToArray();
    }

    private static string BuildFiscalFileName(
        string prefix,
        string? accessKey,
        int number,
        short serie,
        DateTime createdAtUtc)
    {
        var key = string.IsNullOrWhiteSpace(accessKey) ? $"n{number}-s{serie}" : accessKey;
        return $"{prefix}-{key}-{createdAtUtc:yyyyMMddHHmmss}.xml";
    }

    private static byte[] BuildSalesCsv(AccountingExportRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("numero_venda,data_hora_utc,cliente,telefone,documento,valor_bruto,desconto,valor_liquido,forma_pagamento,status,canal");

        foreach (var row in req.SalesRows)
        {
            sb.Append(Escape(row.PublicId)).Append(',');
            sb.Append(Escape(row.CompletedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))).Append(',');
            sb.Append(Escape(row.CustomerName ?? "-")).Append(',');
            sb.Append(Escape(row.CustomerPhone ?? "-")).Append(',');
            sb.Append(Escape(row.CustomerDocument ?? "-")).Append(',');
            sb.Append(Escape(row.GrossAmount.ToString("0.00", CultureInfo.InvariantCulture))).Append(',');
            sb.Append(Escape(row.DiscountAmount.ToString("0.00", CultureInfo.InvariantCulture))).Append(',');
            sb.Append(Escape(row.NetAmount.ToString("0.00", CultureInfo.InvariantCulture))).Append(',');
            sb.Append(Escape(row.PaymentMethod)).Append(',');
            sb.Append(Escape(row.Status)).Append(',');
            sb.Append(Escape(row.Channel));
            sb.AppendLine();
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string Escape(string value)
    {
        if (!value.Contains('"') && !value.Contains(',') && !value.Contains('\n'))
            return value;

        return $"\"{value.Replace("\"", "\"\"")}\"";
    }

    private static byte[] BuildSummaryPdf(AccountingExportRequest req)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(24, Unit.Point);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(10).FontColor("#18181b"));

                page.Content().Column(col =>
                {
                    col.Spacing(8);
                    col.Item().Text("Fechamento Contabil - vendApps").Bold().FontSize(16);
                    col.Item().Text($"Empresa: {req.CompanyName}").FontSize(11);
                    col.Item().Text($"CNPJ: {req.CompanyCnpj}").FontSize(11);
                    col.Item().Text($"Periodo: {req.PeriodStartUtc:dd/MM/yyyy} a {req.PeriodEndUtc.AddSeconds(-1):dd/MM/yyyy}").FontSize(11);
                    col.Item().Text($"Gerado em UTC: {DateTime.UtcNow:dd/MM/yyyy HH:mm:ss}").FontSize(9).FontColor("#555555");

                    col.Item().PaddingVertical(6).LineHorizontal(1).LineColor("#e5e7eb");

                    col.Item().Text("Resumo financeiro").Bold().FontSize(12);
                    col.Item().Text($"Faturamento bruto: {Fmt(req.GrossAmount)}");
                    col.Item().Text($"Descontos: {Fmt(req.DiscountAmount)}");
                    col.Item().Text($"Total liquido: {Fmt(req.NetAmount)}");
                    col.Item().Text($"Vendas concluidas: {req.CompletedSalesCount}");
                    col.Item().Text($"Vendas canceladas/estornadas: {req.CancelledSalesCount}");
                    col.Item().Text($"Ticket medio: {Fmt(req.AverageTicket)}");

                    col.Item().PaddingTop(8).Text("Resumo fiscal").Bold().FontSize(12);
                    col.Item().Text($"XML emitidos: {req.FiscalIssuedRows.Count}");
                    col.Item().Text($"XML cancelados: {req.FiscalCanceledRows.Count}");

                    col.Item().PaddingTop(8).Text("Formas de pagamento").Bold().FontSize(12);
                    if (req.PaymentBreakdown.Count == 0)
                    {
                        col.Item().Text("Sem pagamentos no periodo.");
                    }
                    else
                    {
                        foreach (var payment in req.PaymentBreakdown)
                        {
                            col.Item().Text($"{payment.Method}: {Fmt(payment.TotalAmount)} ({payment.Count} transacoes)");
                        }
                    }
                });
            });
        });

        return doc.GeneratePdf();
    }

    private static string Fmt(decimal value) =>
        $"R$ {value:N2}".Replace(",", "X").Replace(".", ",").Replace("X", ".");

    private static GeneratedAttachment CreateAttachment(string type, string fileName, byte[] content)
    {
        using var sha = SHA256.Create();
        var hash = Convert.ToHexString(sha.ComputeHash(content)).ToLowerInvariant();

        return new GeneratedAttachment(
            type,
            fileName,
            content,
            content.LongLength,
            hash);
    }
}

public sealed record AccountingExportRequest(
    string PeriodReference,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string CompanyName,
    string CompanyCnpj,
    IReadOnlyList<FiscalXmlRow> FiscalIssuedRows,
    IReadOnlyList<FiscalXmlRow> FiscalCanceledRows,
    IReadOnlyList<SalesDetailRow> SalesRows,
    IReadOnlyList<PaymentBreakdownRow> PaymentBreakdown,
    int CompletedSalesCount,
    int CancelledSalesCount,
    decimal GrossAmount,
    decimal DiscountAmount,
    decimal NetAmount,
    decimal AverageTicket,
    bool IncludeXmls,
    bool IncludeSalesCsv,
    bool IncludeSummaryPdf);

public sealed record GeneratedAttachment(
    string AttachmentType,
    string FileName,
    byte[] Content,
    long SizeBytes,
    string Sha256);
