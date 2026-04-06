using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Dav;

/// <summary>
/// Documento Auxiliar de Venda (DAV) / Orçamento.
/// Pode ser criado manualmente ou gerado automaticamente de um pedido de delivery entregue.
/// O fluxo normal é: Draft → AwaitingFiscalConfirmation → FiscalConfirmed → Converted (PDV).
/// </summary>
public class SalesQuote
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // ── Tenant ──────────────────────────────────────────────
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Identificação ─────────────────────────────────────
    /// <summary>ID público legível (ex: DAV-20260312-004994).</summary>
    [MaxLength(30)]
    public string PublicId { get; set; } = "";

    // ── Origem ────────────────────────────────────────────
    public SalesQuoteOrigin Origin { get; set; } = SalesQuoteOrigin.Manual;

    /// <summary>ID do pedido de delivery que originou este DAV (quando Origin = DeliveryOrder).</summary>
    public Guid? OriginOrderId { get; set; }

    // ── Cliente ───────────────────────────────────────────
    public Guid? CustomerId { get; set; }

    [MaxLength(120)]
    public string CustomerName { get; set; } = "";

    [MaxLength(30)]
    public string? CustomerPhone { get; set; }

    /// <summary>CPF ou CNPJ do cliente (opcional, para NFC-e com CPF na nota — Fase 5).</summary>
    [MaxLength(20)]
    public string? CustomerDocument { get; set; }

    // ── Pagamento ─────────────────────────────────────────
    [MaxLength(50)]
    public string PaymentMethod { get; set; } = "PIX";

    // ── Totais ────────────────────────────────────────────
    public int SubtotalCents { get; set; }
    public int DiscountCents { get; set; } = 0;
    public int TotalCents { get; set; }

    // ── Status ────────────────────────────────────────────
    public SalesQuoteStatus Status { get; set; } = SalesQuoteStatus.Draft;

    // ── Fiscal (Fase 5) ───────────────────────────────────
    /// <summary>FiscalDocument emitido para este DAV. Preenchido na Fase 5.</summary>
    public Guid? FiscalDocumentId { get; set; }

    // ── Conversão para PDV ────────────────────────────────
    /// <summary>SaleOrder PDV gerado quando este DAV foi convertido.</summary>
    public Guid? SaleOrderId { get; set; }

    // ── Observações ───────────────────────────────────────
    [MaxLength(500)]
    public string? Notes { get; set; }

    // ── Timestamps ───────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? FiscalConfirmedAtUtc { get; set; }
    public DateTime? ConvertedAtUtc { get; set; }

    // -- Ciclo de vida / Expiração -------------------------------------------
    /// <summary>Data/hora em que o DAV expira automaticamente (default: +24h desde criação).</summary>
    public DateTime? ExpiresAtUtc { get; set; }

    /// <summary>True = DAV foi arquivado (abandonado ou expirado). Não aparece nas listagens padrão.</summary>
    public bool IsArchived { get; set; } = false;

    /// <summary>Data/hora em que o DAV foi arquivado.</summary>
    public DateTime? ArchivedAtUtc { get; set; }

    // ── Navegações ────────────────────────────────────────
    public List<SalesQuoteItem> Items { get; set; } = new();
}
