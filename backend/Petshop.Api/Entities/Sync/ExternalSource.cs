using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Sync;

public enum SourceType { Db, Api, File }

public enum ConnectorType
{
    MySql, Postgres, SqlServer, Oracle, Firebird,
    RestErp, Csv, Excel, Json, Xml
}

public enum SyncMode { Manual, Scheduled }

public class ExternalSource
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    [Required, MaxLength(120)]
    public string Name { get; set; } = default!;

    public SourceType SourceType { get; set; }

    public ConnectorType ConnectorType { get; set; }

    /// <summary>JSON criptografado com detalhes de conexão (FilePath, Url, ApiKey, etc.)</summary>
    public string? ConnectionConfigEncrypted { get; set; }

    public bool IsActive { get; set; } = true;

    public SyncMode SyncMode { get; set; } = SyncMode.Manual;

    [MaxLength(50)]
    public string? ScheduleCron { get; set; }

    public DateTime? LastSyncAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
