namespace Petshop.Api.Contracts.Orders;

public sealed class CreateOrderRequest
{
    // Itens do carrinho (vários)
    public List<CreateOrderItemRequest> Items { get; init; } = new();

    // Dados do Cliente
    public string Name { get; init; } = "";
    public string Phone { get; init; } = "";
    public string Cep { get; init; } = "";
    public string Address { get; init; } = "";
    public string? Complement { get; init; }

    // Pagamento (PIX / CARD_ON_DELIVERY) — opcional por enquanto
    public string PaymentMethodStr { get; init; } = "PIX";
    public int? CashGivenCents { get; init; }  // quanto o cliente vai pagar (somente se for CASH)

    // Cupom — opcional
    public string? Coupon { get; init; }

    // ── Auto-atendimento via mesa ─────────────────────────────────────────────
    /// <summary>ID da mesa (auto-atendimento via QR). Quando preenchido, endereço é opcional.</summary>
    public Guid? TableId { get; init; }

    /// <summary>CPF do cliente para cadastro no programa de fidelidade (opcional).</summary>
    public string? CustomerCpf { get; init; }
}

public sealed class CreateOrderItemRequest
{
    public Guid ProductId { get; init; }
    public int Qty { get; init; }
}
