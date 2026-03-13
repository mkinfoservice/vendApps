namespace Petshop.Api.Entities.Dav;

public enum SalesQuoteStatus
{
    /// <summary>Rascunho — pode ser editado e cancelado.</summary>
    Draft = 0,

    /// <summary>Gerado automaticamente de pedido entregue. Aguarda confirmação fiscal.</summary>
    AwaitingFiscalConfirmation = 1,

    /// <summary>Fiscal confirmado (NFC-e emitida ou dispensa registrada).</summary>
    FiscalConfirmed = 2,

    /// <summary>Convertido para SaleOrder no PDV.</summary>
    Converted = 3,

    /// <summary>Cancelado.</summary>
    Cancelled = 4
}
