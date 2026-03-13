namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Decisão fiscal para uma venda — determinada pelo FiscalDecisionService
/// com base na forma de pagamento e nas configurações do caixa.
/// </summary>
public enum FiscalDecision
{
    /// <summary>Transmitir imediatamente para o SEFAZ via fila de emissão.</summary>
    AutoIssue,

    /// <summary>
    /// Contingência temporária — salvar localmente e tentar reenvio automático.
    /// Prazo legal: até 48 horas após emissão em contingência.
    /// </summary>
    Contingency,

    /// <summary>
    /// Contingência permanente — NÃO transmitir automaticamente ao SEFAZ.
    /// Aparece nos relatórios de caixa. Só vai ao SEFAZ se o operador
    /// habilitar "Enviar contingências em dinheiro para o SEFAZ".
    /// </summary>
    PermanentContingency
}
