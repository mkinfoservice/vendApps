using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Catalog;

public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(120)]
    public string Name { get; set; } = default!;

    [Required, MaxLength(80)]
    public string Slug { get; set; } = default!;

    [MaxLength(80)]
    public string Segment { get; set; } = "petshop";

    public string? SettingsJson { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
