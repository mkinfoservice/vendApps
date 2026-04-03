using Petshop.Api.Entities.Pdv;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Petshop.Api.Services.Pdv;

/// <summary>
/// Gera um recibo PDF simples para a venda PDV, para envio via WhatsApp.
/// Não é a DANFE oficial — é um comprovante auxiliar amigável ao cliente.
/// </summary>
public class SaleReceiptPdfService
{
    public byte[] Generate(SaleOrder sale, string companyName)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A6);
                page.Margin(16, Unit.Point);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(9).FontColor("#111111"));

                page.Content().Column(col =>
                {
                    // Header
                    col.Item().AlignCenter().Text(companyName)
                        .Bold().FontSize(13).FontColor("#1a1a1a");

                    col.Item().AlignCenter().Text("Comprovante de Venda")
                        .FontSize(9).FontColor("#555555");

                    col.Item().PaddingVertical(4).LineHorizontal(0.5f).LineColor("#cccccc");

                    // Sale metadata
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text($"Nº {sale.PublicId}").Bold();
                        row.RelativeItem().AlignRight()
                            .Text((sale.CompletedAtUtc ?? sale.CreatedAtUtc)
                                  .ToLocalTime()
                                  .ToString("dd/MM/yyyy HH:mm"));
                    });

                    if (!string.IsNullOrWhiteSpace(sale.CustomerName))
                    {
                        col.Item().PaddingTop(2).Text($"Cliente: {sale.CustomerName}")
                            .FontSize(8).FontColor("#444444");
                    }

                    col.Item().PaddingVertical(4).LineHorizontal(0.5f).LineColor("#cccccc");

                    // Items
                    foreach (var item in sale.Items)
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text(item.ProductNameSnapshot).FontSize(8);
                            row.ConstantItem(80).AlignRight()
                                .Text(FormatCents(item.TotalCents)).FontSize(8);
                        });

                        if (item.IsSoldByWeight && item.WeightKg.HasValue)
                        {
                            col.Item().PaddingLeft(6).Text(
                                $"{item.WeightKg:F3} kg × {FormatCents(item.UnitPriceCentsSnapshot)}/kg")
                                .FontSize(7).FontColor("#777777");
                        }
                        else if (item.Qty != 1)
                        {
                            col.Item().PaddingLeft(6).Text(
                                $"{item.Qty:G} × {FormatCents(item.UnitPriceCentsSnapshot)}")
                                .FontSize(7).FontColor("#777777");
                        }
                    }

                    col.Item().PaddingVertical(4).LineHorizontal(0.5f).LineColor("#cccccc");

                    // Subtotal / Discount / Total
                    if (sale.DiscountCents > 0)
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Subtotal").FontSize(8);
                            row.ConstantItem(80).AlignRight()
                                .Text(FormatCents(sale.SubtotalCents)).FontSize(8);
                        });
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Desconto").FontSize(8).FontColor("#c00000");
                            row.ConstantItem(80).AlignRight()
                                .Text($"- {FormatCents(sale.DiscountCents)}").FontSize(8).FontColor("#c00000");
                        });
                    }

                    col.Item().PaddingTop(2).Row(row =>
                    {
                        row.RelativeItem().Text("TOTAL").Bold().FontSize(11);
                        row.ConstantItem(80).AlignRight()
                            .Text(FormatCents(sale.TotalCents)).Bold().FontSize(11);
                    });

                    col.Item().PaddingVertical(3).LineHorizontal(0.5f).LineColor("#cccccc");

                    // Payments
                    foreach (var p in sale.Payments)
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text(FormatPaymentLabel(p.PaymentMethod)).FontSize(8);
                            row.ConstantItem(80).AlignRight()
                                .Text(FormatCents(p.AmountCents)).FontSize(8);
                        });
                        if (p.ChangeCents > 0)
                        {
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Troco").FontSize(8).FontColor("#555555");
                                row.ConstantItem(80).AlignRight()
                                    .Text(FormatCents(p.ChangeCents)).FontSize(8).FontColor("#555555");
                            });
                        }
                    }

                    col.Item().PaddingVertical(4).LineHorizontal(0.5f).LineColor("#cccccc");

                    // Footer
                    col.Item().AlignCenter().Text("Documento auxiliar — NFC-e autorizada pela SEFAZ")
                        .FontSize(7).FontColor("#888888").Italic();
                    col.Item().AlignCenter().Text("Obrigado pela preferência!")
                        .FontSize(8).FontColor("#555555");
                });
            });
        });

        return doc.GeneratePdf();
    }

    private static string FormatCents(int cents)
    {
        var v = cents / 100m;
        return $"R$ {v:N2}".Replace('.', ',');
    }

    private static string FormatPaymentLabel(string method) => method.ToUpper() switch
    {
        "PIX"            => "Pix",
        "DINHEIRO"       => "Dinheiro",
        "CARTAO_CREDITO" => "Cartão de Crédito",
        "CARTAO_DEBITO"  => "Cartão de Débito",
        "CASH"           => "Dinheiro",
        "CARD"           => "Cartão",
        _                => method
    };
}
