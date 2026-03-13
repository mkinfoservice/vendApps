using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Determina o fluxo fiscal de uma venda com base na forma de pagamento
/// e nas configurações do caixa.
///
/// Regras:
///   Cartão  → sempre AutoIssue (transmite imediatamente)
///   PIX     → AutoIssue se AutoIssuePix = true; caso contrário Contingency
///   Dinheiro → PermanentContingency por padrão
///              só vai ao SEFAZ se SendCashContingencyToSefaz = true
/// </summary>
public class FiscalDecisionService
{
    /// <summary>
    /// Avalia a decisão fiscal para uma venda.
    /// </summary>
    public FiscalDecision Evaluate(FiscalPaymentMethod method, CashRegisterFiscalSettings settings)
    {
        return method switch
        {
            // Cartão (crédito/débito/TEF): sempre emite — sem exceção
            FiscalPaymentMethod.Card => FiscalDecision.AutoIssue,

            // PIX: configurável pelo operador do caixa
            FiscalPaymentMethod.Pix when settings.AutoIssuePix => FiscalDecision.AutoIssue,
            FiscalPaymentMethod.Pix => FiscalDecision.Contingency,

            // Dinheiro: contingência permanente por padrão
            FiscalPaymentMethod.Cash when settings.SendCashContingencyToSefaz => FiscalDecision.AutoIssue,
            FiscalPaymentMethod.Cash => FiscalDecision.PermanentContingency,

            // Cheque, Other: emitir automaticamente
            _ => FiscalDecision.AutoIssue
        };
    }

    /// <summary>A decisão deve resultar em transmissão imediata ao SEFAZ?</summary>
    public bool ShouldAutoTransmit(FiscalDecision decision) =>
        decision == FiscalDecision.AutoIssue;

    /// <summary>A venda é contingência permanente (nunca vai ao SEFAZ automaticamente)?</summary>
    public bool IsPermanentContingency(FiscalDecision decision) =>
        decision == FiscalDecision.PermanentContingency;
}

/// <summary>
/// Configurações fiscais do caixa — controla emissão por forma de pagamento.
/// Persistido no CashRegister (Fase 3). Aqui como DTO/value object standalone.
/// </summary>
public class CashRegisterFiscalSettings
{
    /// <summary>Emitir NFC-e automaticamente para vendas em PIX? (padrão: sim)</summary>
    public bool AutoIssuePix { get; set; } = true;

    /// <summary>
    /// Enviar vendas em dinheiro para o SEFAZ?
    /// false → ficam em contingência permanente local (padrão e recomendado pelos contadores).
    /// true  → transmite normalmente junto com as demais formas de pagamento.
    /// </summary>
    public bool SendCashContingencyToSefaz { get; set; } = false;
}
