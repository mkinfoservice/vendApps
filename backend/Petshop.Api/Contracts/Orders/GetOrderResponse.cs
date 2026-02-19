namespace Petshop.Api.Contracts.Orders;

public sealed class GetOrderResponse
{
    public Guid Id { get; init; }
    public string OrderNumber { get; init; } = "";
    public string Status { get; init; } = "";
    public string Name { get; init; } = "";
    public string Phone { get; init; } = "";
    public string Cep { get; init; } = "";
    public string Address { get; init; } = "";

    public int SubtotalCents { get; init; }
    public int DeliveryCents { get; init; }
    public int TotalCents { get; init; }

    public string PaymentMethodStr { get; init; } = "";
    public int? CashGivenCents { get; init; }
    public int? ChangeCents { get; init; }
    public string? Coupon { get; init; }
    public DateTime CreatedAtUtc { get; init;  }
    public List<GetOrderItemResponse> Items { get; init; } = new();
}

public sealed class GetOrderItemResponse
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = "";
    public int Qty { get; init; }
    public int UnitPriceCents { get; init; }
    public int TotalPriceCents { get; init; }
}

