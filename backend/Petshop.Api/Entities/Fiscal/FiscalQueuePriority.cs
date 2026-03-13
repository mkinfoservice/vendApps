namespace Petshop.Api.Entities.Fiscal;

public enum FiscalQueuePriority
{
    Normal,  // emissão padrão (delivery em lote, dinheiro)
    High,    // cartão e PIX — exige resposta rápida
    Urgent   // reprocessamento de contingência próxima do vencimento
}
