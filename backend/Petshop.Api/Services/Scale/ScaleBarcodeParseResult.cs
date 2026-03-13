using Petshop.Api.Entities.Scale;

namespace Petshop.Api.Services.Scale;

/// <summary>
/// Resultado do parse de um código de barras de balança.
/// </summary>
public class ScaleBarcodeParseResult
{
    /// <summary>true = código reconhecido como barcode de balança e produto localizado.</summary>
    public bool Success { get; init; }

    public string? ErrorMessage { get; init; }

    // ── Produto ───────────────────────────────────────────────────────

    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = "";
    public string? ScaleProductCode { get; init; }
    public ScaleBarcodeMode BarcodeMode { get; init; }

    // ── Quantidade e preço calculados ─────────────────────────────────

    /// <summary>Peso em kg (somente quando BarcodeMode = WeightEncoded).</summary>
    public decimal? WeightKg { get; init; }

    /// <summary>Peso bruto em gramas lido do barcode (antes da tara).</summary>
    public decimal? GrossWeightGrams { get; init; }

    /// <summary>Tara em gramas descontada.</summary>
    public decimal TareGrams { get; init; }

    /// <summary>
    /// Preço total calculado em centavos.
    /// WeightEncoded: round(WeightKg × PriceCents)
    /// PriceEncoded: valor lido diretamente do barcode
    /// </summary>
    public int TotalPriceCents { get; init; }

    /// <summary>Preço por kg em centavos (para exibição no PDV).</summary>
    public int PricePerKgCents { get; init; }

    /// <summary>Quantidade para o item do carrinho (kg para WeightEncoded, 1 para PriceEncoded).</summary>
    public decimal Quantity { get; init; }

    // ── Barcode original ──────────────────────────────────────────────

    public string OriginalBarcode { get; init; } = "";

    // ── Factory methods ───────────────────────────────────────────────

    public static ScaleBarcodeParseResult NotAScaleBarcode() => new()
    {
        Success = false,
        ErrorMessage = "Código não reconhecido como barcode de balança (não começa com '2' ou tamanho incorreto)."
    };

    public static ScaleBarcodeParseResult ProductNotFound(string code) => new()
    {
        Success = false,
        ErrorMessage = $"Produto com código de balança '{code}' não cadastrado nesta empresa."
    };

    public static ScaleBarcodeParseResult Error(string message) => new()
    {
        Success = false,
        ErrorMessage = message
    };
}
