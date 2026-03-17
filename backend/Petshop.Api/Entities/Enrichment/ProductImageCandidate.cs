using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities.Enrichment;

public enum ImageCandidateStatus { Pending, Approved, Rejected, AutoApplied, Failed }
public enum ImageCandidateSource { EanDatabase, NameSearch, Manual }

/// <summary>
/// Candidata de imagem encontrada para um produto durante o enriquecimento.
/// Score >= AutoApplyImageThreshold → aplicada automaticamente (se produto não tem imagem).
/// Score entre ReviewThreshold e AutoApplyThreshold → marcada Pending para revisão.
/// Score abaixo de ReviewThreshold → Rejected automaticamente.
/// </summary>
public class ProductImageCandidate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public Guid BatchId { get; set; }
    public EnrichmentBatch Batch { get; set; } = default!;

    // ── Dados da busca ────────────────────────────────────────────────────────
    [MaxLength(300)]
    public string? SearchQuery { get; set; }

    /// <summary>URL da imagem na fonte externa (antes de download local).</summary>
    [MaxLength(500)]
    public string? CandidateUrl { get; set; }

    /// <summary>URL local após download e armazenamento (preenchida somente quando aplicada).</summary>
    [MaxLength(500)]
    public string? LocalUrl { get; set; }

    [MaxLength(30)]
    public string Source { get; set; } = ImageCandidateSource.EanDatabase.ToString();

    // ── Scoring ───────────────────────────────────────────────────────────────
    public decimal ConfidenceScore { get; set; }

    /// <summary>JSON com breakdown do score por campo (barcode, name, brand, category).</summary>
    public string? ScoreBreakdownJson { get; set; }

    // ── Metadados do candidato (para exibição na revisão) ──────────────────────
    [MaxLength(300)]
    public string? CandidateName { get; set; }

    [MaxLength(150)]
    public string? CandidateBrand { get; set; }

    [MaxLength(30)]
    public string? CandidateBarcode { get; set; }

    // ── Status e revisão ──────────────────────────────────────────────────────
    public ImageCandidateStatus Status { get; set; } = ImageCandidateStatus.Pending;

    [MaxLength(100)]
    public string? ReviewedByUserId { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }
    public DateTime? AttemptedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
