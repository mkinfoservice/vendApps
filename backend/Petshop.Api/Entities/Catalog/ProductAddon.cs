using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Catalog;

/// <summary>
/// Adicional opcional de um produto (ex: "Adicional de chocolate", "Tamanho extra").
/// O valor é acrescido ao preço do produto quando selecionado no PDV.
/// </summary>
public class ProductAddon
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    [Required, MaxLength(100)]
    public string Name { get; set; } = "";

    /// <summary>Valor em centavos acrescido ao preço do produto.</summary>
    public int PriceCents { get; set; } = 0;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
