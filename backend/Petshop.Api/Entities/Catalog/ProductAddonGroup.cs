using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Catalog;

/// <summary>
/// Grupo de adicionais de um produto (ex: "Tipo de Leite", "Cobertura", "Adicionais").
/// Cada grupo vira uma etapa no fluxo de customização step-by-step do produto.
/// </summary>
public class ProductAddonGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    [Required, MaxLength(80)]
    public string Name { get; set; } = "";

    /// <summary>Se true, o usuário deve selecionar ao menos MinSelections (mínimo 1) antes de avançar.</summary>
    public bool IsRequired { get; set; } = false;

    /// <summary>"single" = radio (apenas um); "multiple" = checkbox (vários).</summary>
    [MaxLength(10)]
    public string SelectionType { get; set; } = "multiple";

    /// <summary>Mínimo de itens obrigatórios. Relevante quando IsRequired = true (padrão efetivo: 1).</summary>
    public int MinSelections { get; set; } = 0;

    /// <summary>Máximo de itens selecionáveis. 0 = sem limite.</summary>
    public int MaxSelections { get; set; } = 0;

    public int SortOrder { get; set; } = 0;

    public List<ProductAddon> Addons { get; set; } = new();
}
