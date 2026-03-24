using System.Drawing;
using System.Drawing.Printing;
using PrintAgent.Models;

namespace PrintAgent.Services;

/// <summary>
/// Imprime um recibo de pedido silenciosamente (sem diálogo) na impressora padrão
/// ou em outra impressora configurada em PrintAgent:PrinterName.
/// Usa System.Drawing.Printing — Windows only.
/// </summary>
public class SilentPrintService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SilentPrintService> _logger;

    // Constantes de layout (pontos = 1/100 polegada no contexto de PrintDocument)
    private const float MarginLeft  = 20f;
    private const float LineHeight  = 16f;
    private const float FontSize    = 8f;
    private const float FontSizeSm  = 7f;
    private const float FontSizeLg  = 10f;

    public SilentPrintService(IConfiguration config, ILogger<SilentPrintService> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Imprime o payload diretamente, sem abrir qualquer janela ou diálogo.
    /// </summary>
    public void Print(PrintOrderPayload payload)
    {
        try
        {
            var doc = new PrintDocument();

            // Usa a impressora configurada; se vazia, usa a padrão do sistema
            var printerName = _config["PrintAgent:PrinterName"];
            if (!string.IsNullOrWhiteSpace(printerName))
                doc.PrinterSettings.PrinterName = printerName;

            doc.PrintPage += (_, e) => RenderReceipt(e, payload);

            // Print() NÃO abre diálogo — vai direto para a fila de impressão
            doc.Print();

            _logger.LogInformation(
                "Impresso pedido {PublicId} em {Printer}",
                payload.PublicId,
                doc.PrinterSettings.PrinterName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao imprimir pedido {PublicId}", payload.PublicId);
            throw;
        }
    }

    // ── Renderização ─────────────────────────────────────────────────────────

    private static void RenderReceipt(PrintPageEventArgs e, PrintOrderPayload p)
    {
        var g      = e.Graphics!;
        var width  = e.PageBounds.Width - MarginLeft * 2;
        var y      = (float)e.MarginBounds.Top;

        using var fontNormal = new Font("Courier New", FontSize,   FontStyle.Regular);
        using var fontBold   = new Font("Courier New", FontSize,   FontStyle.Bold);
        using var fontSmall  = new Font("Courier New", FontSizeSm, FontStyle.Regular);
        using var fontLarge  = new Font("Courier New", FontSizeLg, FontStyle.Bold);
        using var brush      = new SolidBrush(Color.Black);

        var center = new StringFormat { Alignment = StringAlignment.Center };
        var right  = new StringFormat { Alignment = StringAlignment.Far };

        // ── Cabeçalho ──────────────────────────────────────────────────────
        g.DrawString("vendapps.com.br", fontSmall, brush,
            new RectangleF(MarginLeft, y, width, LineHeight), center);
        y += LineHeight + 4;

        g.DrawString("PEDIDO CONFIRMADO", fontLarge, brush,
            new RectangleF(MarginLeft, y, width, LineHeight * 1.4f), center);
        y += LineHeight * 1.6f;

        var date = p.CreatedAtUtc.ToLocalTime().ToString("dd/MM/yyyy HH:mm");
        g.DrawString($"#{p.PublicId}  {date}", fontBold, brush,
            new RectangleF(MarginLeft, y, width, LineHeight), center);
        y += LineHeight + 4;

        y = DrawSeparator(g, fontSmall, brush, y, width);

        // ── Cliente ────────────────────────────────────────────────────────
        y = DrawLine(g, fontBold, brush, y, $"CLIENTE");
        y = DrawLine(g, fontNormal, brush, y, p.CustomerName);
        if (!string.IsNullOrWhiteSpace(p.Phone))
            y = DrawLine(g, fontNormal, brush, y, p.Phone);
        if (!string.IsNullOrWhiteSpace(p.Address))
            y = DrawLine(g, fontNormal, brush, y, p.Address +
                (string.IsNullOrWhiteSpace(p.Complement) ? "" : $" - {p.Complement}"));
        if (!string.IsNullOrWhiteSpace(p.Cep) && p.Cep != "00000-000")
            y = DrawLine(g, fontNormal, brush, y, $"CEP: {p.Cep}");

        y = DrawSeparator(g, fontSmall, brush, y, width);

        // ── Itens ──────────────────────────────────────────────────────────
        y = DrawLine(g, fontBold, brush, y, "ITENS");
        foreach (var item in p.Items)
        {
            var total = item.Qty * item.UnitCents;
            var left  = $"{item.Qty}x {Truncate(item.Name, 22)}";
            var right2 = FormatBRL(total);

            // Nome do produto + valor alinhado à direita
            g.DrawString(left,   fontNormal, brush, new RectangleF(MarginLeft, y, width, LineHeight));
            g.DrawString(right2, fontNormal, brush, new RectangleF(MarginLeft, y, width, LineHeight), right);
            y += LineHeight;

            // Preço unitário se qty > 1
            if (item.Qty > 1)
            {
                g.DrawString($"  {FormatBRL(item.UnitCents)} cada", fontSmall, brush,
                    new RectangleF(MarginLeft, y, width, LineHeight));
                y += LineHeight;
            }
        }

        y = DrawSeparator(g, fontSmall, brush, y, width);

        // ── Totais ─────────────────────────────────────────────────────────
        if (p.DeliveryCents > 0)
        {
            DrawTwoCol(g, fontNormal, brush, y, width, "Subtotal", FormatBRL(p.SubtotalCents));
            y += LineHeight;
            DrawTwoCol(g, fontNormal, brush, y, width, "Entrega", FormatBRL(p.DeliveryCents));
            y += LineHeight;
        }

        DrawTwoCol(g, fontBold, brush, y, width, "TOTAL", FormatBRL(p.TotalCents));
        y += LineHeight + 2;

        // ── Pagamento ──────────────────────────────────────────────────────
        DrawTwoCol(g, fontNormal, brush, y, width, "Pagamento", p.PaymentMethod);
        y += LineHeight;

        if (p.PaymentMethod == "Dinheiro" && p.CashGivenCents.HasValue)
        {
            DrawTwoCol(g, fontNormal, brush, y, width, "  Recebido", FormatBRL(p.CashGivenCents.Value));
            y += LineHeight;
            DrawTwoCol(g, fontNormal, brush, y, width, "  Troco", FormatBRL(p.ChangeCents ?? 0));
            y += LineHeight;
        }

        y = DrawSeparator(g, fontSmall, brush, y, width);

        // ── Rodapé ─────────────────────────────────────────────────────────
        g.DrawString("Entregue pelo petshop", fontSmall, brush,
            new RectangleF(MarginLeft, y, width, LineHeight), center);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static float DrawLine(Graphics g, Font font, Brush brush, float y, string text)
    {
        g.DrawString(text, font, brush, new RectangleF(MarginLeft, y, 400, LineHeight));
        return y + LineHeight;
    }

    private static void DrawTwoCol(Graphics g, Font font, Brush brush,
        float y, float width, string left, string right)
    {
        var rf = new RectangleF(MarginLeft, y, width, LineHeight);
        g.DrawString(left,  font, brush, rf);
        g.DrawString(right, font, brush, rf,
            new StringFormat { Alignment = StringAlignment.Far });
    }

    private static float DrawSeparator(Graphics g, Font font, Brush brush, float y, float width)
    {
        var sep = new string('-', 42);
        g.DrawString(sep, font, brush,
            new RectangleF(MarginLeft, y, width, LineHeight),
            new StringFormat { Alignment = StringAlignment.Center });
        return y + LineHeight + 2;
    }

    private static string FormatBRL(int cents) =>
        (cents / 100.0).ToString("C", new System.Globalization.CultureInfo("pt-BR"));

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s[..max] + "…";
}
