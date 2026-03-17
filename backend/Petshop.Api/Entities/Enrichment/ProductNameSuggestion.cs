using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Enrichment;

public enum NameSuggestionStatus { Pending, Approved, Rejected, AutoApplied }
public enum NameSuggestionSource { DeterministicRules, LlmAssisted }

/// <summary>
/// Sugestão de nome normalizado para um produto.
/// O nome original NUNCA é alterado — apenas NameDisplayed (campo futuro ou via aprovação manual).
/// Aprovação pelo admin aplica o nome sugerido ao Product.Name e loga em ProductChangeLog.
/// </summary>
public class ProductNameSuggestion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public Guid BatchId { get; set; }
    public EnrichmentBatch Batch { get; set; } = default!;

    // ── Conteúdo da sugestão ──────────────────────────────────────────────────
    /// <summary>Nome original do produto no momento da sugestão (imutável, para auditoria).</summary>
    public string OriginalName { get; set; } = default!;

    /// <summary>Nome normalizado sugerido.</summary>
    public string SuggestedName { get; set; } = default!;

    /// <summary>JSON array com os steps de normalização aplicados (ex: ["collapse-spaces","normalize-unit:kgs"]).</summary>
    public string? NormalizationStepsJson { get; set; }

    /// <summary>Score de confiança entre 0.0 e 1.0.</summary>
    public decimal ConfidenceScore { get; set; }

    public NameSuggestionSource Source { get; set; } = NameSuggestionSource.DeterministicRules;

    // ── Status e revisão ──────────────────────────────────────────────────────
    public NameSuggestionStatus Status { get; set; } = NameSuggestionStatus.Pending;

    [MaxLength(100)]
    public string? ReviewedByUserId { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
