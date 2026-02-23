namespace Petshop.Api.Services.Sync;

/// <summary>
/// DTO normalizado que todos os conectores devem produzir.
/// Desacopla o formato da origem do modelo de domínio interno.
/// </summary>
public class ExternalProductDto
{
    /// <summary>ID único na origem (ex: ID do ERP, linha do CSV).</summary>
    public string? ExternalId { get; set; }

    public string? InternalCode { get; set; }
    public string? Barcode { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? CategoryName { get; set; }
    public string? BrandName { get; set; }
    public string Unit { get; set; } = "UN";

    /// <summary>Custo em centavos (0 se não informado).</summary>
    public int CostCents { get; set; }

    /// <summary>Preço de venda em centavos.</summary>
    public int PriceCents { get; set; }

    public decimal StockQty { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Ncm { get; set; }
    public string? ImageUrl { get; set; }

    /// <summary>Timestamp de atualização na origem (para delta sync).</summary>
    public DateTime? UpdatedAtUtc { get; set; }

    /// <summary>Hash pré-calculado pela origem, se disponível. Caso contrário, calculado pelo ProductHashService.</summary>
    public string? RawHash { get; set; }
}
