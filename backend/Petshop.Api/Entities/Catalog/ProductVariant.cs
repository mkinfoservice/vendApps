using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Catalog;

public class ProductVariant
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    [Required, MaxLength(40)]
    public string VariantKey { get; set; } = default!;

    [Required, MaxLength(80)]
    public string VariantValue { get; set; } = default!;

    [MaxLength(30)]
    public string? Barcode { get; set; }

    public int? PriceCents { get; set; }

    public decimal StockQty { get; set; } = 0;

    public bool IsActive { get; set; } = true;
}
