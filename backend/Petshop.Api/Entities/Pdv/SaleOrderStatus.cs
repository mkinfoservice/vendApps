namespace Petshop.Api.Entities.Pdv;

public enum SaleOrderStatus
{
    /// <summary>Sendo montada — itens ainda sendo adicionados.</summary>
    Open = 0,

    /// <summary>Finalizada e paga.</summary>
    Completed = 1,

    /// <summary>Cancelada antes do pagamento.</summary>
    Cancelled = 2,

    /// <summary>Estornada após pagamento (NFC-e cancelada — Fase 5).</summary>
    Voided = 3
}
