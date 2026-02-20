using Petshop.Api.Entities.Sync;

namespace Petshop.Api.Services.Sync;

public class ExternalProductQuery
{
    public Guid SourceId { get; set; }
    public SyncType SyncType { get; set; } = SyncType.Full;
    public DateTime? UpdatedSince { get; set; }
    public int BatchSize { get; set; } = 100;
    public int Page { get; set; } = 1;
}
