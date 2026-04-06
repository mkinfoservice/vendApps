using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Pdv;

/// <summary>
/// Venda no PDV. Ciclo: Open → Completed (pago) | Cancelled | Voided (Fase 5).
/// </summary>
public class SaleOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // ── Tenant ──────────────────────────────────────────────
    public Guid CompanyId { get; set; }

    // ── Identificação ─────────────────────────────────────
    [MaxLength(30)]
    public string PublicId { get; set; } = "";

    // ── Sessão / Terminal ─────────────────────────────────
    public Guid CashSessionId { get; set; }
    public CashSession CashSession { get; set; } = default!;

    public Guid CashRegisterId { get; set; }

    /// <summary>Snapshot do nome do terminal no momento da venda.</summary>
    [MaxLength(80)]
    public string? CashRegisterNameSnapshot { get; set; }

    // Operador
    /// <summary>ID do usuario admin que realizou a venda.</summary>
    public Guid? OperatorUserId { get; set; }

    /// <summary>Snapshot do nome do operador no momento da venda.</summary>
    [MaxLength(100)]
    public string? OperatorName { get; set; }

    // ── Origem (DAV) ──────────────────────────────────────
    /// <summary>DAV que originou esta venda (nullable — venda direta no PDV).</summary>
    public Guid? SalesQuoteId { get; set; }

    // ── Cliente ───────────────────────────────────────────
    public Guid? CustomerId { get; set; }

    [MaxLength(120)]
    public string CustomerName { get; set; } = "";

    [MaxLength(30)]
    public string? CustomerPhone { get; set; }

    [MaxLength(20)]
    public string? CustomerDocument { get; set; }

    // ── Totais ────────────────────────────────────────────
    public int SubtotalCents { get; set; }
    public int DiscountCents { get; set; } = 0;
    public int TotalCents { get; set; }

    // ── Status ────────────────────────────────────────────
    public SaleOrderStatus Status { get; set; } = SaleOrderStatus.Open;

    // ── Fiscal (Fase 5) ───────────────────────────────────
    /// <summary>
    /// Decisão fiscal calculada no pagamento (AutoIssue, Contingency, PermanentContingency).
    /// Persistida como string para rastreabilidade.
    /// </summary>
    [MaxLength(30)]
    public string FiscalDecision { get; set; } = "AutoIssue";

    public Guid? FiscalDocumentId { get; set; }

    // ── Observações ───────────────────────────────────────
    [MaxLength(500)]
    public string? Notes { get; set; }

    // ── Timestamps ───────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }

    // ── Navegações ────────────────────────────────────────
    public List<SaleOrderItem> Items { get; set; } = new();
    public List<SalePayment> Payments { get; set; } = new();
}
