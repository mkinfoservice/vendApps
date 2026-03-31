using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.StoreFront;

/// <summary>
/// Mesa do restaurante/petshop — isolada por empresa.
/// </summary>
public class Table
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    /// <summary>Número da mesa (ex: 1, 2, 3).</summary>
    public int Number { get; set; }

    /// <summary>Nome amigável (opcional — ex: "Varanda", "Vip 1").</summary>
    [MaxLength(100)]
    public string? Name { get; set; }

    /// <summary>Capacidade de pessoas.</summary>
    public int Capacity { get; set; } = 4;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
