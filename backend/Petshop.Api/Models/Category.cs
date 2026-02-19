using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Models;

/// <summary>
/// Categoria do catálogo (ração, petisco, remédio, etc.)
/// </summary>
public class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Nome visível no app (ex: "Ração")
    [Required, MaxLength(80)]
    public string Name { get; set; } = default!;

    // Slug para URL/filtro (ex: "racao")
    [Required, MaxLength(80)]
    public string Slug { get; set; } = default!;

    // Navegação: uma categoria tem vários produtos
    public List<Product> Products { get; set; } = new();
}
