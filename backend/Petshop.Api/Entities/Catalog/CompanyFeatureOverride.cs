using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Catalog;

public class CompanyFeatureOverride
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    [MaxLength(80)]
    public string FeatureKey { get; set; } = "";

    public bool IsEnabled { get; set; }

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
