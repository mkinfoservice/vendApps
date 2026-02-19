namespace Petshop.Api.Entities;

public enum OrderStatus
{
    RECEBIDO = 0,
    EM_PREPARO = 1,
    SAIU_PARA_ENTREGA = 2,

    PRONTO_PARA_ENTREGA = 3, // novo (usa o gap, não quebra o banco)

    ENTREGUE = 4,
    CANCELADO = 5
}
