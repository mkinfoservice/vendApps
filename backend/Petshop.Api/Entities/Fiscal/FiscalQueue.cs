using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Fila de emissão fiscal — desacopla o fechamento da venda da transmissão ao SEFAZ.
/// Permite emissão assíncrona, em lote (delivery) e reprocessamento de contingências.
/// </summary>
public class FiscalQueue
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    /// <summary>
    /// ID da SaleOrder a fiscalizar.
    /// FK completa será adicionada na Fase 2 (quando SaleOrder for implementado).
    /// </summary>
    public Guid SaleOrderId { get; set; }

    /// <summary>Preenchido após a emissão do FiscalDocument correspondente.</summary>
    public Guid? FiscalDocumentId { get; set; }
    public FiscalDocument? FiscalDocument { get; set; }

    public FiscalQueuePriority Priority { get; set; } = FiscalQueuePriority.Normal;

    public FiscalQueueStatus Status { get; set; } = FiscalQueueStatus.Waiting;

    /// <summary>Quando este item deve ser processado (null = o quanto antes).</summary>
    public DateTime? ScheduledForUtc { get; set; }

    public DateTime? ProcessedAtUtc { get; set; }

    public int RetryCount { get; set; } = 0;

    public string? FailureReason { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
