using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Accounting;

public class AccountingDispatchConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    public bool IsEnabled { get; set; } = false;

    [MaxLength(160)]
    public string? AccountantName { get; set; }

    [MaxLength(200)]
    public string? PrimaryEmail { get; set; }

    /// <summary>Emails em copia, separados por ';'.</summary>
    [MaxLength(1000)]
    public string? CcEmails { get; set; }

    public AccountingDispatchFrequency Frequency { get; set; } = AccountingDispatchFrequency.Monthly;
    public int DayOfMonth { get; set; } = 5;
    public int DayOfWeek { get; set; } = 1; // 0 domingo .. 6 sabado

    /// <summary>Horario no formato HH:mm.</summary>
    [MaxLength(5)]
    public string SendTimeLocal { get; set; } = "09:00";

    [MaxLength(80)]
    public string TimezoneId { get; set; } = "America/Sao_Paulo";

    public bool IncludeXmlIssued { get; set; } = true;
    public bool IncludeXmlCanceled { get; set; } = false;
    public bool IncludeSalesCsv { get; set; } = true;
    public bool IncludeSummaryPdf { get; set; } = true;

    public int MaxRetryCount { get; set; } = 2;
    public int RetryDelayMinutes { get; set; } = 15;

    [MaxLength(1000)]
    public string? FixedEmailNote { get; set; }

    public bool ProtectAttachments { get; set; } = false;

    [MaxLength(300)]
    public string? AttachmentPassword { get; set; }

    public int MaxAttachmentSizeMb { get; set; } = 15;

    public AccountingSendWhenNoMovement SendWhenNoMovement { get; set; } = AccountingSendWhenNoMovement.Skip;

    public DateTime? LastSentAtUtc { get; set; }
    public DateTime? LastSuccessAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(120)]
    public string? UpdatedBy { get; set; }
}
