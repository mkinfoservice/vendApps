using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Master;

/// <summary>
/// Alerta para o painel admin — exibido como popup ao acessar o sistema.
/// Criado automaticamente por jobs (ex: insumos baixos).
/// </summary>
public class AdminAlert
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    /// <summary>"supply_low" | "stock_low" | "custom"</summary>
    [Required, MaxLength(40)]
    public string AlertType { get; set; } = "custom";

    [Required, MaxLength(200)]
    public string Title { get; set; } = "";

    [Required]
    public string Message { get; set; } = "";

    /// <summary>ID da entidade relacionada (ex: Supply.Id).</summary>
    public Guid? ReferenceId { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAtUtc { get; set; }
}
