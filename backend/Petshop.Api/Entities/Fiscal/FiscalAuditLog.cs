using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Log de auditoria fiscal imutável.
/// Registra toda ação fiscal relevante: emissões, cancelamentos, rejeições, reenvios.
/// Sem FKs — CompanyId e EntityId são referências livres para evitar problemas de cascade.
/// </summary>
public class FiscalAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    /// <summary>Tipo da entidade afetada (ex: "FiscalDocument", "FiscalQueue", "SaleOrder").</summary>
    [MaxLength(60)]
    public string EntityType { get; set; } = "";

    public Guid EntityId { get; set; }

    /// <summary>Ação executada (ex: "Transmitted", "Authorized", "Rejected", "Cancelled", "ContingencySet").</summary>
    [MaxLength(60)]
    public string Action { get; set; } = "";

    /// <summary>ID do usuário que executou a ação. Null quando executado por job/sistema.</summary>
    public Guid? ActorId { get; set; }

    /// <summary>"User", "System" ou "Job".</summary>
    [MaxLength(20)]
    public string ActorType { get; set; } = "System";

    [MaxLength(30)]
    public string? OldStatus { get; set; }

    [MaxLength(30)]
    public string? NewStatus { get; set; }

    /// <summary>Detalhes adicionais em JSON (código de rejeição, protocolo, chave de acesso, etc.).</summary>
    public string? Details { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
