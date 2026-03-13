using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Documento fiscal emitido (NFC-e, NFe, SAT).
/// Registra o ciclo completo: emissão → autorização/rejeição/contingência → cancelamento.
/// </summary>
public class FiscalDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    /// <summary>
    /// ID da SaleOrder de origem.
    /// FK completa será adicionada na Fase 2 (quando SaleOrder for implementado).
    /// Por ora: coluna plain Guid sem restrição de FK.
    /// </summary>
    public Guid? SaleOrderId { get; set; }

    // ── Identificação do documento ───────────────────────────────────

    public FiscalDocumentType DocumentType { get; set; } = FiscalDocumentType.NFCe;

    /// <summary>Série da NFC-e (ex: 001).</summary>
    public short Serie { get; set; }

    /// <summary>Número sequencial da NFC-e — controlado por NfceNumberControl.</summary>
    public int Number { get; set; }

    /// <summary>Chave de acesso de 44 dígitos — única. Gerada pelo ACBr.</summary>
    [MaxLength(44)]
    public string? AccessKey { get; set; }

    // ── Status ───────────────────────────────────────────────────────

    public FiscalDocumentStatus FiscalStatus { get; set; } = FiscalDocumentStatus.Pending;

    public ContingencyType ContingencyType { get; set; } = ContingencyType.None;

    // ── XML ──────────────────────────────────────────────────────────

    /// <summary>XML completo assinado da NFC-e/NFe (gerado pelo ACBr).</summary>
    public string? XmlContent { get; set; }

    /// <summary>XML de retorno com o protocolo de autorização da SEFAZ.</summary>
    public string? XmlProtocol { get; set; }

    // ── Autorização ──────────────────────────────────────────────────

    [MaxLength(100)]
    public string? AuthorizationCode { get; set; }

    public DateTime? AuthorizationDateTimeUtc { get; set; }

    // ── Rejeição ─────────────────────────────────────────────────────

    [MaxLength(10)]
    public string? RejectCode { get; set; }

    [MaxLength(500)]
    public string? RejectMessage { get; set; }

    // ── Tentativas de transmissão ─────────────────────────────────────

    public int TransmissionAttempts { get; set; } = 0;

    public DateTime? LastAttemptAtUtc { get; set; }

    // ── Timestamps ───────────────────────────────────────────────────

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
