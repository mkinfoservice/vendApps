using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Accounting;

public class AccountingDispatchAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid RunId { get; set; }
    public AccountingDispatchRun? Run { get; set; }

    [MaxLength(30)]
    public string AttachmentType { get; set; } = "";

    [MaxLength(180)]
    public string FileName { get; set; } = "";

    public long SizeBytes { get; set; }

    [MaxLength(64)]
    public string ChecksumSha256 { get; set; } = "";

    [MaxLength(20)]
    public string StorageMode { get; set; } = "Temp";

    [MaxLength(600)]
    public string? StoragePath { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
