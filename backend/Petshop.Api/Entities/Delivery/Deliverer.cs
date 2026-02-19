using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Delivery;

public class Deliverer
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(120)]
    public string Name { get; set; } = "";

    [MaxLength(30)]
    public string Phone { get; set; } = "";
    public string Vehicle { get; set; } = ""; // ex: "Moto - Honda CG 160 PLACA: ABC1234"

    [MaxLength(100)]
    public string PinHash { get; set; } = "";

    public bool IsActive { get; set; } = true;

    // Última posição conhecida (app do entregador pode enviar)
    public double? LastLatitude { get; set; }
    public double? LastLongitude { get; set; }
    public DateTime? LastLocationAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navegação
    public List<Route> Routes { get; set; } = new();
}
