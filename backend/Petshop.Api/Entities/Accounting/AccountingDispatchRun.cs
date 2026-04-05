using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Accounting;

public class AccountingDispatchRun
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    public DateTime PeriodStartUtc { get; set; }
    public DateTime PeriodEndUtc { get; set; }

    [MaxLength(20)]
    public string PeriodReference { get; set; } = "";

    public AccountingDispatchTriggerType TriggerType { get; set; } = AccountingDispatchTriggerType.Automatic;
    public AccountingDispatchRunStatus Status { get; set; } = AccountingDispatchRunStatus.Pending;

    [MaxLength(80)]
    public string CorrelationId { get; set; } = "";

    [MaxLength(120)]
    public string IdempotencyKey { get; set; } = "";

    [MaxLength(200)]
    public string? PrimaryRecipient { get; set; }

    [MaxLength(1000)]
    public string? CcRecipients { get; set; }

    public int XmlCountIssued { get; set; }
    public int XmlCountCanceled { get; set; }
    public int SalesCount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal GrossAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CanceledAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal NetAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal AverageTicket { get; set; }

    public string PaymentBreakdownJson { get; set; } = "{}";

    [MaxLength(100)]
    public string? ErrorCode { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(120)]
    public string? CreatedBy { get; set; }

    public ICollection<AccountingDispatchAttachment> Attachments { get; set; } = new List<AccountingDispatchAttachment>();
}
