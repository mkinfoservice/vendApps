using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Master;

/// <summary>
/// Usuário administrador de uma empresa ou do Master Admin.
/// CompanyId=null → role=master_admin (acesso global).
/// CompanyId preenchido → role=admin (acesso restrito à empresa).
/// </summary>
public class AdminUser
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // null = master_admin; preenchido = admin de empresa
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    [Required, MaxLength(80)]
    public string Username { get; set; } = default!;

    [MaxLength(200)]
    public string? Email { get; set; }

    /// <summary>Hash BCrypt da senha (mesmo algoritmo usado em Deliverer.PinHash).</summary>
    [Required, MaxLength(100)]
    public string PasswordHash { get; set; } = default!;

    /// <summary>"master_admin" | "admin"</summary>
    [Required, MaxLength(30)]
    public string Role { get; set; } = "admin";

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>ID do master_admin que criou este usuário (para rastreabilidade).</summary>
    public Guid? CreatedByMasterUserId { get; set; }
}
