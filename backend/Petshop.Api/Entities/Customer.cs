using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Customers;
using Petshop.Api.Entities.Master;

namespace Petshop.Api.Entities;

/// <summary>
/// Cliente cadastrado pela equipe da loja (atendimento telefônico).
/// Isolado por empresa (CompanyId).
/// </summary>
public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Catalog.Company? Company { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = default!;

    /// <summary>Telefone normalizado (ex: 21999998888)</summary>
    [Required, MaxLength(20)]
    public string Phone { get; set; } = default!;

    /// <summary>CPF — armazenado criptografado (AES via ASP.NET Core Data Protection)</summary>
    [MaxLength(500)]
    public string? Cpf { get; set; }

    /// <summary>HMAC-SHA256 do CPF normalizado — para queries de igualdade sem expor o plaintext</summary>
    [MaxLength(64)]
    public string? CpfHash { get; set; }

    // ── Endereço ─────────────────────────────────────────────

    [MaxLength(10)]
    public string? Cep { get; set; }

    /// <summary>Logradouro + número (ex: "Rua das Flores, 123")</summary>
    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? Complement { get; set; }

    /// <summary>Preenchido automaticamente via ViaCEP</summary>
    [MaxLength(100)]
    public string? Neighborhood { get; set; }

    /// <summary>Preenchido automaticamente via ViaCEP</summary>
    [MaxLength(100)]
    public string? City { get; set; }

    /// <summary>UF — preenchido via ViaCEP</summary>
    [MaxLength(2)]
    public string? State { get; set; }

    [MaxLength(300)]
    public string? AddressReference { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    // ── Geocodificação ────────────────────────────────────────

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime? GeocodedAtUtc { get; set; }

    // ── Auditoria ─────────────────────────────────────────────

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    // ── Fidelidade (Fase 9) ───────────────────────────────────

    [MaxLength(100)]
    public string? Email { get; set; }

    public DateOnly? BirthDate { get; set; }

    public int PointsBalance { get; set; }
    public int TotalSpentCents { get; set; }
    public int TotalOrders { get; set; }
    public DateTime? LastOrderUtc { get; set; }

    // ── Navegação ─────────────────────────────────────────────

    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public List<LoyaltyTransaction> LoyaltyTransactions { get; set; } = new();
}
