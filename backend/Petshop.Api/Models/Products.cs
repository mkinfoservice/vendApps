using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Models;

/// <summary>
/// Produto do catálogo.
/// </summary>
public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(160)]
    public string Name { get; set; } = default!;

    [Required, MaxLength(160)]
    public string Slug { get; set; } = default!;

    /// <summary>
    /// Preço em centavos (boa prática para evitar problemas com float/double)
    /// Ex: R$ 189,90 => 18990
    /// </summary>
    [Range(0, int.MaxValue)]
    public int PriceCents { get; set; }

    // URL da imagem (depois podemos usar S3/Cloudflare R2)
    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    // Soft delete / ocultar no catálogo
    public bool IsActive { get; set; } = true;

    // FK + navegação
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = default!;
}
