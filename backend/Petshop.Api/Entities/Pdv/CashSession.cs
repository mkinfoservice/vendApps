using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Pdv;

/// <summary>
/// Turno/sessão de caixa. Um terminal só pode ter uma sessão aberta por vez.
/// Ao fechar, consolida totais: contagem de vendas, total por forma de pagamento,
/// e quantas vendas em dinheiro ficaram em contingência permanente (não vão ao SEFAZ).
/// </summary>
public class CashSession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // ── Tenant ──────────────────────────────────────────────
    public Guid CompanyId { get; set; }

    // ── Terminal ──────────────────────────────────────────
    public Guid CashRegisterId { get; set; }
    public CashRegister CashRegister { get; set; } = default!;

    // ── Operadores ───────────────────────────────────────
    public Guid OpenedByUserId { get; set; }

    [MaxLength(120)]
    public string OpenedByUserName { get; set; } = "";

    public Guid? ClosedByUserId { get; set; }

    [MaxLength(120)]
    public string? ClosedByUserName { get; set; }

    // ── Status ────────────────────────────────────────────
    public CashSessionStatus Status { get; set; } = CashSessionStatus.Open;

    // ── Balanço ──────────────────────────────────────────
    /// <summary>Fundo de caixa ao abrir (troco disponível, em centavos).</summary>
    public int OpeningBalanceCents { get; set; } = 0;

    /// <summary>Fundo de caixa ao fechar (contagem física, em centavos).</summary>
    public int? ClosingBalanceCents { get; set; }

    // ── Totalizadores (calculados ao fechar) ─────────────
    public int TotalSalesCount { get; set; } = 0;
    public int TotalSalesCents { get; set; } = 0;

    /// <summary>Qtd de vendas em dinheiro que ficaram em contingência permanente.</summary>
    public int PermanentContingencyCount { get; set; } = 0;

    [MaxLength(500)]
    public string? Notes { get; set; }

    // ── Timestamps ───────────────────────────────────────
    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAtUtc { get; set; }

    // ── Navegações ────────────────────────────────────────
    public List<SaleOrder>     Sales     { get; set; } = new();
    public List<CashMovement>  Movements { get; set; } = new();
}
