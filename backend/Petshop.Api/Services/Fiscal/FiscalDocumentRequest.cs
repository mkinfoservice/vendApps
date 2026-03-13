using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Dados completos para emissão de NFC-e (Fase 5).
/// Montado pelo FiscalQueueProcessorJob a partir do SaleOrder + FiscalConfig.
/// </summary>
public class FiscalDocumentRequest
{
    public Guid CompanyId        { get; init; }
    public Guid SaleOrderId      { get; init; }
    public Guid FiscalDocumentId { get; init; }

    public FiscalDocumentType DocumentType { get; init; } = FiscalDocumentType.NFCe;
    public short Serie  { get; init; }
    public int   Number { get; init; }

    public ContingencyType ContingencyType     { get; init; } = ContingencyType.None;
    public DateTime?       ContingencyStartUtc { get; init; }

    /// <summary>Data/hora da venda (UTC — convertida para BRT no XML).</summary>
    public DateTime SaleDateTimeUtc { get; init; }

    public int SubtotalCents { get; init; }
    public int DiscountCents { get; init; }
    public int TotalCents    { get; init; }

    public string? CustomerDocument { get; init; }
    public string? CustomerName     { get; init; }

    public required EmitterData Emitter { get; init; }

    public IReadOnlyList<FiscalItemData>    Items    { get; init; } = [];
    public IReadOnlyList<FiscalPaymentData> Payments { get; init; } = [];
}

// ── Emitter ───────────────────────────────────────────────────────────────────

public record EmitterData(
    string Cnpj,
    string InscricaoEstadual,
    string RazaoSocial,
    string? NomeFantasia,
    string Uf,
    string Logradouro,
    string NumeroEndereco,
    string? Complemento,
    string Bairro,
    int    CodigoMunicipio,
    string NomeMunicipio,
    string Cep,
    string? Telefone,
    string DefaultCfop,
    string? CscId,
    string? CscToken,
    SefazEnvironment SefazEnvironment,
    TaxRegime TaxRegime);

// ── Items ─────────────────────────────────────────────────────────────────────

public record FiscalItemData(
    int     ItemNumber,
    string  ProductCode,
    string  Barcode,
    string  ProductName,
    string  Ncm,
    string  Cfop,
    string  Unit,
    decimal Quantity,
    decimal UnitPriceCents,
    decimal TotalCents,
    bool    IsSoldByWeight);

// ── Payments ──────────────────────────────────────────────────────────────────

public record FiscalPaymentData(
    string PaymentMethod,
    int    AmountCents,
    int    ChangeCents);
