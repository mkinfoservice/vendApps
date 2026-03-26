using System.Globalization;
using System.Text.Json;

namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Input que descreve o produto a ser enriquecido.
/// </summary>
public record EnrichmentProductInput(
    Guid ProductId,
    Guid CompanyId,
    string Name,
    string? Barcode,
    string? Brand,
    string? CategoryName);

/// <summary>
/// Candidata de imagem retornada por um matcher.
/// </summary>
public record ImageMatchCandidate(
    string Source,
    string ImageUrl,
    string? CandidateName,
    string? CandidateBrand,
    string? CandidateBarcode,
    string SearchQuery)
{
    public decimal ConfidenceScore { get; set; }
    public Dictionary<string, decimal> ScoreBreakdown { get; set; } = new();
    public string ScoreBreakdownJson => JsonSerializer.Serialize(ScoreBreakdown);
}

public enum ImageDecisionType { None, AutoApply, PendingReview, Reject }

public record ImageMatchingDecision(
    ImageDecisionType Decision,
    ImageMatchCandidate? Candidate,
    string Reason);

/// <summary>
/// Calcula score de candidatas de imagem e decide o que fazer com elas.
/// Lógica portada e adaptada do pacote externo vendapps_enrichment_service.
/// </summary>
public sealed class EnrichmentScoringService
{
    public ImageMatchingDecision Decide(
        EnrichmentProductInput input,
        IReadOnlyList<ImageMatchCandidate> candidates,
        decimal autoApplyThreshold,
        decimal reviewThreshold,
        bool alreadyHasApprovedImage)
    {
        // Regra de ouro: nunca sobrescrever imagem já existente e aprovada
        if (alreadyHasApprovedImage)
            return new ImageMatchingDecision(ImageDecisionType.None, null, "Produto já possui imagem aprovada.");

        if (candidates.Count == 0)
            return new ImageMatchingDecision(ImageDecisionType.Reject, null, "Nenhum candidato encontrado.");

        // Calcular score para cada candidata
        foreach (var candidate in candidates)
        {
            var breakdown = BuildScoreBreakdown(input, candidate);
            candidate.ScoreBreakdown.Clear();
            foreach (var kv in breakdown)
                candidate.ScoreBreakdown[kv.Key] = kv.Value;
            candidate.ConfidenceScore = breakdown.Values.Sum();
        }

        var best = candidates.OrderByDescending(c => c.ConfidenceScore).First();

        if (best.ConfidenceScore >= autoApplyThreshold)
            return new ImageMatchingDecision(
                ImageDecisionType.AutoApply, best,
                $"Score {best.ConfidenceScore:F2} acima do threshold de auto-apply ({autoApplyThreshold:F2}).");

        if (best.ConfidenceScore >= reviewThreshold)
            return new ImageMatchingDecision(
                ImageDecisionType.PendingReview, best,
                $"Score {best.ConfidenceScore:F2} exige revisão humana (mín. auto-apply: {autoApplyThreshold:F2}).");

        return new ImageMatchingDecision(
            ImageDecisionType.Reject, best,
            $"Score {best.ConfidenceScore:F2} abaixo do mínimo para revisão ({reviewThreshold:F2}).");
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private static IReadOnlyDictionary<string, decimal> BuildScoreBreakdown(
        EnrichmentProductInput input,
        ImageMatchCandidate candidate)
    {
        var scores = new Dictionary<string, decimal>();

        bool barcodeMatch = !string.IsNullOrWhiteSpace(input.Barcode)
            && !string.IsNullOrWhiteSpace(candidate.CandidateBarcode)
            && string.Equals(NormalizeDigits(input.Barcode), NormalizeDigits(candidate.CandidateBarcode),
                             StringComparison.Ordinal);

        if (barcodeMatch)
        {
            // Barcode exato: pesos originais — alta precisão
            scores["barcode"]  = 0.70m;
            scores["name"]     = StringSimilarity(input.Name, candidate.CandidateName) * 0.20m;
            scores["brand"]    = StringSimilarity(input.Brand, candidate.CandidateBrand) * 0.08m;
            scores["category"] = 0.02m;
        }
        else
        {
            // Sem barcode: redistribui pesos para nome e marca — permite revisão humana
            scores["barcode"]  = 0m;
            scores["name"]     = StringSimilarity(input.Name, candidate.CandidateName) * 0.75m;
            scores["brand"]    = StringSimilarity(input.Brand, candidate.CandidateBrand) * 0.20m;
            scores["category"] = 0.05m;
        }

        return scores;
    }

    private static decimal StringSimilarity(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right))
            return 0m;

        left  = NormalizeText(left);
        right = NormalizeText(right);

        if (left == right) return 1m;

        var wordsLeft  = left.Split(' ',  StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var wordsRight = right.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        if (wordsLeft.Count == 0 || wordsRight.Count == 0) return 0m;

        var overlap = wordsLeft.Intersect(wordsRight).Count();
        var union   = wordsLeft.Union(wordsRight).Count();
        return union == 0 ? 0m : (decimal)overlap / union;
    }

    private static string NormalizeDigits(string? value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : new string(value.Where(char.IsDigit).ToArray());

    private static string NormalizeText(string value)
    {
        var chars = value
            .Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray();
        return new string(chars).ToLowerInvariant();
    }
}
