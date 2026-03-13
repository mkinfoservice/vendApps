namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Forma de pagamento do ponto de vista fiscal (independente do enum de delivery).
/// Usado pelo FiscalDecisionService para determinar o fluxo de emissão.
/// </summary>
public enum FiscalPaymentMethod
{
    Cash,   // dinheiro
    Card,   // crédito ou débito (maquininha / TEF)
    Pix,
    Check,  // cheque
    Other
}
