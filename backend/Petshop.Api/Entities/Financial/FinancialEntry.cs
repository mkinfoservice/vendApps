using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Financial;

/// <summary>Tipo da movimentação financeira.</summary>
public enum FinancialEntryType
{
    Receita = 0,  // conta a receber / receita
    Despesa = 1,  // conta a pagar / despesa
}

/// <summary>
/// Conta a pagar ou a receber.
/// Representa lançamentos financeiros manuais ou gerados automaticamente pelo sistema.
/// </summary>
public class FinancialEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public FinancialEntryType Type { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = "";

    /// <summary>Valor em centavos (sempre positivo).</summary>
    public int AmountCents { get; set; }

    /// <summary>Data de vencimento.</summary>
    public DateOnly DueDate { get; set; }

    /// <summary>Data em que foi pago/recebido. Null = pendente.</summary>
    public DateOnly? PaidDate { get; set; }

    public bool IsPaid { get; set; } = false;

    /// <summary>Categoria livre (ex: "Aluguel", "Salários", "Estoque").</summary>
    [MaxLength(80)]
    public string? Category { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>Referência opcional a uma entidade do sistema (ex: "PurchaseOrder").</summary>
    [MaxLength(40)]
    public string? ReferenceType { get; set; }

    public Guid? ReferenceId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
