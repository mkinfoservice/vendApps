using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Agenda;

public class ServiceType
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    [Required, MaxLength(100)]
    public string Name { get; set; } = "";

    /// <summary>Duração estimada em minutos.</summary>
    public int DurationMinutes { get; set; } = 60;

    /// <summary>Preço padrão em centavos.</summary>
    public int DefaultPriceCents { get; set; }

    /// <summary>Categoria livre (ex: "Banho e Tosa", "Veterinário").</summary>
    [MaxLength(80)]
    public string? Category { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
