using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities; // Order

namespace Petshop.Api.Entities.Delivery;

public class RouteStop
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // FK para Route
    public Guid RouteId { get; set; }
    public Route Route { get; set; } = null!;

    // FK para Order
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    // Ordem da entrega na rota
    public int Sequence { get; set; }

    public RouteStopStatus Status { get; set; } = RouteStopStatus.Pendente;

    // Snapshot (para não depender de joins futuros / mudanças no pedido)
    [MaxLength(30)]
    public string OrderNumberSnapshot { get; set; } = "";

    [MaxLength(120)]
    public string CustomerNameSnapshot { get; set; } = "";

    [MaxLength(30)]
    public string CustomerPhoneSnapshot { get; set; } = "";

    [MaxLength(300)]
    public string AddressSnapshot { get; set; } = "";

    // Geocoding (opcional)
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public DateTime? DeliveredAtUtc { get; set; }
    public DateTime? FailedAtUtc { get; set; }

    [MaxLength(250)]
    public string? FailureReason { get; set; }
}
