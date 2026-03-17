using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Petshop.Api.Services.Enrichment;

/// <summary>
/// Resultado da normalização de nome de um produto.
/// </summary>
public record NameNormalizationResult(
    string OriginalName,
    string SuggestedName,
    decimal ConfidenceScore,
    IReadOnlyList<string> AppliedSteps)
{
    public bool HasChanges => !string.Equals(OriginalName, SuggestedName, StringComparison.Ordinal);
    public string StepsJson => JsonSerializer.Serialize(AppliedSteps);
}

/// <summary>
/// Normaliza nomes de produtos por pipeline determinístico de regras.
/// Lógica portada e adaptada do pacote externo vendapps_enrichment_service.
/// Não altera nenhum dado no banco — apenas computa sugestões.
/// </summary>
public sealed partial class ProductNormalizationService
{
    // ── Mapeamentos ───────────────────────────────────────────────────────────

    private static readonly Dictionary<string, string> UnitMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["kgs"]       = "kg",
        ["quilo"]     = "kg",
        ["quilos"]    = "kg",
        ["gramas"]    = "g",
        ["grama"]     = "g",
        ["litros"]    = "l",
        ["litro"]     = "l",
        ["mililitros"] = "ml",
        ["mililitro"] = "ml",
        ["unid"]      = "un",
        ["unidade"]   = "un",
        ["unidades"]  = "un"
    };

    private static readonly Dictionary<string, string> AbbreviationMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["racao"]  = "Ração",
        ["pct"]    = "Pacote",
        ["fr"]     = "Frasco",
        ["ad"]     = "Adulto",
        ["filh"]   = "Filhote",
        ["comp"]   = "Comprimido",
        ["caps"]   = "Cápsulas",
        ["tb"]     = "Tablete"
    };

    // ── API pública ───────────────────────────────────────────────────────────

    public NameNormalizationResult Normalize(string productName)
    {
        var original = productName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(original))
            return new NameNormalizationResult(string.Empty, string.Empty, 0m, []);

        var steps = new List<string>();
        var name = original;

        // 1. Colapsar múltiplos espaços
        var collapsed = MultiSpaceRegex().Replace(name, " ").Trim();
        if (!string.Equals(name, collapsed, StringComparison.Ordinal))
        {
            name = collapsed;
            steps.Add("collapse-spaces");
        }

        // 2. Normalizar separadores (x, -, /) — garante espaços ao redor
        var normalizedSep = Regex.Replace(name, @"\s*([xX\-/])\s*", " $1 ");
        normalizedSep = MultiSpaceRegex().Replace(normalizedSep, " ").Trim();
        if (!string.Equals(name, normalizedSep, StringComparison.Ordinal))
        {
            name = normalizedSep;
            steps.Add("normalize-separators");
        }

        // 3. Expandir abreviações e normalizar unidades (operamos em lowercase)
        var lower = name.ToLowerInvariant();

        foreach (var pair in AbbreviationMap)
        {
            var replaced = Regex.Replace(lower, $@"\b{Regex.Escape(pair.Key.ToLowerInvariant())}\b", pair.Value.ToLowerInvariant());
            if (!string.Equals(lower, replaced, StringComparison.Ordinal))
            {
                lower = replaced;
                steps.Add($"expand-abbreviation:{pair.Key}");
            }
        }

        foreach (var pair in UnitMap)
        {
            var replaced = Regex.Replace(lower, $@"\b{Regex.Escape(pair.Key.ToLowerInvariant())}\b", pair.Value.ToLowerInvariant());
            if (!string.Equals(lower, replaced, StringComparison.Ordinal))
            {
                lower = replaced;
                steps.Add($"normalize-unit:{pair.Key}");
            }
        }

        // 4. Normalizar espaçamento ao redor de unidades de medida
        //    Ex: "500kg" → "500 kg", "1,5kg" → "1,5 kg"
        lower = Regex.Replace(lower, @"\b(\d+)[ ]+(kg|g|ml|l|un)\b", "$1 $2");
        lower = Regex.Replace(lower, @"\b(\d+),(\d+)(kg|g|ml|l)\b", "$1,$2 $3");
        lower = Regex.Replace(lower, @"\b(\d+)(kg|g|ml|l|un)\b", "$1 $2");

        // 5. Title Case (cultura pt-BR)
        var info = CultureInfo.GetCultureInfo("pt-BR");
        var title = info.TextInfo.ToTitleCase(lower);

        // 6. Restaurar acrônimos conhecidos em maiúsculas
        title = AcronymRegex().Replace(title, static m => m.Value.ToUpperInvariant());

        if (!string.Equals(name, title, StringComparison.Ordinal))
            steps.Add("normalize-title-case");

        var score = CalculateConfidence(original, title, steps.Count);

        return new NameNormalizationResult(original, title, score, steps);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    private static decimal CalculateConfidence(string original, string suggested, int stepCount)
    {
        if (string.Equals(original, suggested, StringComparison.Ordinal))
            return 1.0m;

        var ratio = SimilarityRatio(original, suggested);
        var penalty = Math.Min(stepCount * 0.015m, 0.12m);
        return Math.Max(0.70m, Math.Min(0.99m, ratio - penalty + 0.08m));
    }

    private static decimal SimilarityRatio(string left, string right)
    {
        var max = Math.Max(left.Length, right.Length);
        if (max == 0) return 1m;
        return 1m - ((decimal)LevenshteinDistance(left, right) / max);
    }

    private static int LevenshteinDistance(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
            }
        return d[a.Length, b.Length];
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex MultiSpaceRegex();

    // Acrônimos comuns em nomes de produtos (pet, alimentos, fiscal, tech)
    [GeneratedRegex(@"\b(Usa|Pet|Nfc|Pdv|Sku|Drf|Api|Sql|Ean|Gtin|Un|Pis|Cofins|Csosn|Icms)\b")]
    private static partial Regex AcronymRegex();
}
