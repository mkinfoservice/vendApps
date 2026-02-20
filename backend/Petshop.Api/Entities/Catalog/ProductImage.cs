using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Catalog;

public class ProductImage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    [Required, MaxLength(500)]
    public string Url { get; set; } = default!;

    [MaxLength(30)]
    public string StorageProvider { get; set; } = "Local";

    public bool IsPrimary { get; set; } = false;

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
