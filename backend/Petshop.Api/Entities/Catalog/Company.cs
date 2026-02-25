using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Catalog;

public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(120)]
    public string Name { get; set; } = default!;

    [Required, MaxLength(80)]
    public string Slug { get; set; } = default!;

    [MaxLength(80)]
    public string Segment { get; set; } = "petshop";

    public string? SettingsJson { get; set; }

    public bool IsActive { get; set; } = true;

    // ── Master Admin ──────────────────────────────────────

    /// <summary>Soft delete — empresa não aparece nas listagens públicas.</summary>
    public bool IsDeleted { get; set; } = false;

    public DateTime? SuspendedAtUtc { get; set; }

    [MaxLength(300)]
    public string? SuspendedReason { get; set; }

    /// <summary>Plano contratado: "trial" | "starter" | "pro" | "enterprise".</summary>
    [MaxLength(30)]
    public string Plan { get; set; } = "trial";

    public DateTime? PlanExpiresAtUtc { get; set; }

    // ── Timestamps ────────────────────────────────────────
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
