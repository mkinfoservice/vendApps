using Petshop.Api.Models;

namespace Petshop.Api.Entities.Audit;

public class ProductPriceHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public int PriceCents { get; set; }

    public int CostCents { get; set; }

    public decimal MarginPercent { get; set; }

    public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

    public ChangeSource Source { get; set; } = ChangeSource.Manual;

    public Guid? SyncJobId { get; set; }
}
