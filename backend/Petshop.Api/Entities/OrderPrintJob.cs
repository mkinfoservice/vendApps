using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities;

/// <summary>
/// Fila persistente de impressão de pedidos.
/// Garante que nenhum job se perde se o painel admin estiver offline.
/// </summary>
public class OrderPrintJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    /// <summary>Número amigável (ex: PS-2026004994) — snapshot para não depender de join.</summary>
    [MaxLength(30)]
    public string PublicId { get; set; } = "";

    /// <summary>Snapshot em JSON com todos os dados necessários para imprimir sem novo DB hit.</summary>
    public string PrintPayloadJson { get; set; } = "{}";

    public bool IsPrinted { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? PrintedAtUtc { get; set; }
}
