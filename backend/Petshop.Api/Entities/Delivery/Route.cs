using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Delivery;

public class Route
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(30)]
    public string RouteNumber { get; set; } = ""; // ex: RT-20260212-001

    public RouteStatus Status { get; set; } = RouteStatus.Criada;

    // Entregador atribuído (pode ser null até atribuir)
    public Guid? DelivererId { get; set; }
    public Deliverer? Deliverer { get; set; }

    // Métricas (opcionais, mas úteis no admin)
    public int TotalStops { get; set; }
    public double EstimatedDistanceKm { get; set; }
    public int EstimatedDurationMin { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    // Paradas
    public List<RouteStop> Stops { get; set; } = new();
}
