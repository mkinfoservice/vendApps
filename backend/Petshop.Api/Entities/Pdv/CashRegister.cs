using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Pdv;

/// <summary>Terminal PDV físico — gerenciado pelo admin. Cada terminal tem sua série fiscal.</summary>
public class CashRegister
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // ── Tenant ──────────────────────────────────────────────
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    // ── Identificação ─────────────────────────────────────
    [MaxLength(80)]
    public string Name { get; set; } = ""; // ex: "Caixa 1", "PDV Balcão"

    // ── Fiscal (Fase 5) ───────────────────────────────────
    /// <summary>Série NFC-e para este terminal (ex: "001"). Configurado na Fase 5.</summary>
    [MaxLength(3)]
    public string FiscalSerie { get; set; } = "001";

    // ── Configurações fiscais (persistidas inline) ─────────
    /// <summary>Emitir NFC-e automaticamente para vendas em PIX?</summary>
    public bool FiscalAutoIssuePix { get; set; } = true;

    /// <summary>Enviar dinheiro ao SEFAZ? false = contingência permanente (padrão).</summary>
    public bool FiscalSendCashToSefaz { get; set; } = false;

    // ── Status ────────────────────────────────────────────
    public bool IsActive { get; set; } = true;

    // ── Timestamps ───────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // ── Navegações ────────────────────────────────────────
    public List<CashSession> Sessions { get; set; } = new();
}
