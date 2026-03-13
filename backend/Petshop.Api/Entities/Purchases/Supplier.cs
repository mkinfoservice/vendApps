using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Purchases;

public class Supplier
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    [Required, MaxLength(120)]
    public string Name { get; set; } = "";

    /// <summary>CNPJ ou CPF do fornecedor (somente dígitos).</summary>
    [MaxLength(14)]
    public string? Cnpj { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(80)]
    public string? ContactName { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    public List<PurchaseOrder> PurchaseOrders { get; set; } = new();
}
