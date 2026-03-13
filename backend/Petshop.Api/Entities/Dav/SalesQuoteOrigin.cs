namespace Petshop.Api.Entities.Dav;

public enum SalesQuoteOrigin
{
    /// <summary>Criado manualmente no backoffice/PDV.</summary>
    Manual = 0,

    /// <summary>Gerado automaticamente de um pedido de delivery (Order.Status → ENTREGUE).</summary>
    DeliveryOrder = 1
}
