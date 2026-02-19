namespace Petshop.Api.Contracts.Orders;

public sealed class CreateOrderResponse
{
    public Guid Id { get; init; }
    public string OrderNumber { get; init; } = "";
    public string Status { get; init; } = "";


    public int SubtotalCents { get; init; }
    public int DeliveryCents { get; init; }
    public int TotalCents { get; init; }
    
    public string PaymentMethodStr { get; init; } = "";
    public int? CashGivenCents { get; init; }
    public int? ChangeCents { get; init; }
}