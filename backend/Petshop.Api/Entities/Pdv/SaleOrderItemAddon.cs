using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Pdv;

/// <summary>
/// Adicional selecionado para um item da venda no PDV.
/// Snapshot do nome e preço no momento da venda.
/// </summary>
public class SaleOrderItemAddon
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SaleOrderItemId { get; set; }
    public SaleOrderItem SaleOrderItem { get; set; } = default!;

    public Guid AddonId { get; set; }

    [Required, MaxLength(100)]
    public string NameSnapshot { get; set; } = "";

    public int PriceCentsSnapshot { get; set; }
}
