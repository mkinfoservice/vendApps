using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Master;

/// <summary>
/// Log imutável de todas as ações do Master Admin.
/// Sem FKs intencionalmente — o TargetId é string para suportar qualquer tipo de alvo.
/// </summary>
public class MasterAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string ActorUsername { get; set; } = default!;

    [Required, MaxLength(30)]
    public string ActorRole { get; set; } = default!;

    /// <summary>
    /// Ação executada. Exemplos:
    /// "company.create", "company.suspend", "company.reactivate", "company.delete",
    /// "admin.create", "admin.reset_password", "admin.delete",
    /// "settings.update", "whatsapp.update", "impersonate.start"
    /// </summary>
    [Required, MaxLength(80)]
    public string Action { get; set; } = default!;

    /// <summary>"company" | "admin_user" | "settings" | "whatsapp"</summary>
    [Required, MaxLength(50)]
    public string TargetType { get; set; } = default!;

    [Required, MaxLength(100)]
    public string TargetId { get; set; } = default!;

    [MaxLength(200)]
    public string? TargetName { get; set; }

    /// <summary>JSON com o delta ou snapshot da operação (o que mudou).</summary>
    public string? PayloadJson { get; set; }

    [MaxLength(45)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
