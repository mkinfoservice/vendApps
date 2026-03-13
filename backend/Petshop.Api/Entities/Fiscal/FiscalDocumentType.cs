namespace Petshop.Api.Entities.Fiscal;

public enum FiscalDocumentType
{
    NFCe,  // Nota Fiscal de Consumidor eletrônica (PDV)
    NFe,   // Nota Fiscal eletrônica (B2B)
    SAT,   // Sistema Autenticador e Transmissor (São Paulo)
    CFe    // Cupom Fiscal eletrônico (SAT)
}
