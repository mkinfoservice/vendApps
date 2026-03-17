using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Enrichment;

public enum EnrichmentResultStatus { Queued, Processing, Done, Failed, Skipped }

/// <summary>
/// Resultado de enriquecimento de um produto específico dentro de um lote.
/// Atualizado em tempo real pelo job de processamento.
/// </summary>
public class ProductEnrichmentResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid BatchId { get; set; }
    public EnrichmentBatch Batch { get; set; } = default!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public EnrichmentResultStatus Status { get; set; } = EnrichmentResultStatus.Queued;

    /// <summary>true se a normalização de nome foi tentada (independente de gerar sugestão).</summary>
    public bool NameProcessed { get; set; }

    /// <summary>true se o matching de imagem foi tentado.</summary>
    public bool ImageProcessed { get; set; }

    [MaxLength(500)]
    public string? FailureReason { get; set; }

    public DateTime? ProcessedAtUtc { get; set; }
}
