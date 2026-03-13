namespace Petshop.Api.Entities.Scale;

/// <summary>
/// Define como o valor (VVVVV) do código de barras da balança deve ser interpretado.
///
/// Formato do código EAN-13 de balança (padrão brasileiro GS1):
///   2X PPPPP VVVVV C
///   │  │     │     └── dígito verificador
///   │  │     └──────── 5 dígitos: peso em gramas (WeightEncoded) ou preço em centavos (PriceEncoded)
///   │  └────────────── 5 dígitos: código do produto cadastrado na balança (ScaleProductCode)
///   └───────────────── "2x" — prefixo de uso interno (ex: "20")
/// </summary>
public enum ScaleBarcodeMode
{
    /// <summary>
    /// VVVVV = peso em gramas.
    /// Preço total = (VVVVV / 1000.0) × (PriceCents / 100.0)
    /// Exemplo: VVVVV = 00435 → 435g → 0,435 kg × R$89,90/kg = R$39,10
    /// </summary>
    WeightEncoded,

    /// <summary>
    /// VVVVV = preço total em centavos.
    /// Preço total = VVVVV / 100.0
    /// Exemplo: VVVVV = 04350 → R$43,50
    /// </summary>
    PriceEncoded
}
