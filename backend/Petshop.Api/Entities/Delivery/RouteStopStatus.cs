namespace Petshop.Api.Entities.Delivery;

public enum RouteStopStatus
{
    Pendente = 0, // Aguardando sua vez
    Proxima = 1, // Próxima entrega a ser realizada
    Entregue = 2, //Entrega Confirmada
    Falhou = 3, // Tentativa falhou (Vai retornar no endereço)
    Ignorada = 4 // Pulada do roteiro (ex: cliente não atende mais)
}