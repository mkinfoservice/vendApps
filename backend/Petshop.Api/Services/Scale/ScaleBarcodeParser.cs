using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Scale;

namespace Petshop.Api.Services.Scale;

/// <summary>
/// Interpreta códigos de barras de balança (EAN-13 prefixo "2") e resolve o produto.
///
/// Formato EAN-13 de balança (padrão GS1 Brasil — uso interno):
///
///   Posição:   1-2  |  3-7   |  8-12  | 13
///   Conteúdo:  2X   | PPPPP  | VVVVV  |  C
///              │       │        │         └── dígito verificador
///              │       │        └──────────── valor: peso (gramas) ou preço (centavos)
///              │       └───────────────────── código do produto na balança (5 dígitos)
///              └───────────────────────────── prefixo interno ("20", "21", etc.)
///
/// Exemplo WeightEncoded — Picanha 435g, R$89,90/kg:
///   barcode = "2000123004350"  →  produto "00123"  →  435g  →  0,435 × R$89,90 = R$39,10
///
/// Exemplo PriceEncoded — Queijo Mussarela R$43,50:
///   barcode = "2000456043500"  →  produto "00456"  →  R$43,50  →  1 unidade
/// </summary>
public class ScaleBarcodeParser
{
    private readonly AppDbContext _db;
    private readonly ILogger<ScaleBarcodeParser> _logger;

    // Comprimento esperado: EAN-13
    private const int ExpectedLength = 13;

    public ScaleBarcodeParser(AppDbContext db, ILogger<ScaleBarcodeParser> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Verifica se o código é um barcode de balança sem consultar o banco.
    /// </summary>
    public static bool IsScaleBarcode(string barcode) =>
        barcode.Length == ExpectedLength
        && barcode[0] == '2'
        && barcode.All(char.IsDigit);

    /// <summary>
    /// Faz o parse completo do barcode: extrai dados, localiza o produto e calcula o preço.
    /// </summary>
    /// <param name="barcode">Código lido pelo scanner (13 dígitos).</param>
    /// <param name="companyId">Empresa do caixa (multi-tenant).</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ScaleBarcodeParseResult> ParseAsync(
        string barcode,
        Guid companyId,
        CancellationToken ct = default)
    {
        if (!IsScaleBarcode(barcode))
            return ScaleBarcodeParseResult.NotAScaleBarcode();

        // Extrai campos do barcode
        var productCode = barcode.Substring(2, 5);  // posições 3-7 (índice 2-6)
        var valueStr    = barcode.Substring(7, 5);  // posições 8-12 (índice 7-11)

        if (!int.TryParse(valueStr, out var rawValue))
            return ScaleBarcodeParseResult.Error($"Valor inválido no barcode: '{valueStr}'.");

        // Localiza o produto pelo código de balança
        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.CompanyId == companyId
                  && p.ScaleProductCode == productCode
                  && p.IsSoldByWeight
                  && !p.IsSupply
                  && p.IsActive,
                ct);

        if (product == null)
        {
            _logger.LogWarning(
                "[ScaleParser] Produto não encontrado | empresa {CompanyId} | código balança '{Code}'",
                companyId, productCode);

            return ScaleBarcodeParseResult.ProductNotFound(productCode);
        }

        // Calcula conforme o modo configurado no produto
        if (product.ScaleBarcodeMode == ScaleBarcodeMode.WeightEncoded)
        {
            // rawValue = peso em gramas
            var grossGrams = (decimal)rawValue;
            var tareGrams  = product.ScaleTareWeight;
            var netGrams   = Math.Max(0, grossGrams - tareGrams);
            var weightKg   = Math.Round(netGrams / 1000m, 3);

            // Preço total = peso(kg) × preço/kg
            var totalCents = (int)Math.Round(weightKg * product.PriceCents);

            _logger.LogDebug(
                "[ScaleParser] WeightEncoded | produto '{Name}' | {Grams}g bruto | {Net}g líq. | " +
                "{Kg}kg × R${PerKg} = R${Total}",
                product.Name, grossGrams, netGrams, weightKg,
                product.PriceCents / 100m, totalCents / 100m);

            return new ScaleBarcodeParseResult
            {
                Success          = true,
                ProductId        = product.Id,
                ProductName      = product.Name,
                ScaleProductCode = productCode,
                BarcodeMode      = ScaleBarcodeMode.WeightEncoded,
                GrossWeightGrams = grossGrams,
                TareGrams        = tareGrams,
                WeightKg         = weightKg,
                Quantity         = weightKg,
                PricePerKgCents  = product.PriceCents,
                TotalPriceCents  = totalCents,
                OriginalBarcode  = barcode
            };
        }
        else // PriceEncoded
        {
            // rawValue = preço total em centavos
            var totalCents = rawValue;

            _logger.LogDebug(
                "[ScaleParser] PriceEncoded | produto '{Name}' | preço R${Total}",
                product.Name, totalCents / 100m);

            return new ScaleBarcodeParseResult
            {
                Success          = true,
                ProductId        = product.Id,
                ProductName      = product.Name,
                ScaleProductCode = productCode,
                BarcodeMode      = ScaleBarcodeMode.PriceEncoded,
                Quantity         = 1,
                PricePerKgCents  = product.PriceCents,
                TotalPriceCents  = totalCents,
                OriginalBarcode  = barcode
            };
        }
    }
}
