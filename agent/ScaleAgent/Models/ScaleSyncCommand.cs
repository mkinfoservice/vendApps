namespace ScaleAgent.Models;

/// <summary>Produto enviado pelo servidor para programar na balança.</summary>
public record ScaleProductPayload(
    string ScaleProductCode,
    string Name,
    int    PricePerKgCents,
    string BarcodeMode       // "WeightEncoded" | "PriceEncoded"
);
