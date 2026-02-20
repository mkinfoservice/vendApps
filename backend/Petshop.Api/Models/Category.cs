using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Models;

public class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Tenant
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    [Required, MaxLength(80)]
    public string Name { get; set; } = default!;

    [Required, MaxLength(80)]
    public string Slug { get; set; } = default!;

    public List<Product> Products { get; set; } = new();
}
