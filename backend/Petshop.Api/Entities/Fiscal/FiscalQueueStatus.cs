namespace Petshop.Api.Entities.Fiscal;

public enum FiscalQueueStatus
{
    Waiting,    // na fila, aguardando processamento
    Processing, // sendo processado pelo job
    Completed,  // processado com sucesso
    Failed,     // falhou após todas as tentativas
    Skipped     // dispensado manualmente pelo operador
}
