using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities
{
    public class Order
    {
       public Guid Id { get; set; } = Guid.NewGuid(); // ID Técnico (PK)

       [MaxLength(30)]
       public string PublicId { get; set; } = ""; // ID "Humano" do pedido (ex: PS-2026004994)

       [MaxLength(120)]
       public string CustomerName { get; set; } = ""; // Nome do cliente

       [MaxLength(30)]
       public string Phone { get; set; } = ""; // Telefone do cliente

       [MaxLength(12)]
       public string Cep { get; set; } = ""; // CEP do endereço de entrega

       [MaxLength(250)]
       public string Address { get; set; } = ""; // Endereço de entrega
       public double? Latitude { get; set; } // Latitude do endereço (opcional)
       public double? Longitude { get; set; } // Longitude do endereço (opcional)

       // Ajudar Debug:
       public DateTime? GeocodedAtUtc { get; set; } // Quando o endereço foi geocodificado (UTC)
       public string? GeocodeProvider { get; set; } // Qual serviço de geocodificação foi usado (ex: "ORS", "Google", etc)

       [MaxLength(120)]
       public string? Complement { get; set; }

       [MaxLength(30)]
       public string PaymentMethod { get; set; } = "PIX"; // Método de pagamento (string)
       public int? CashGivenCents { get; set; }   // quanto o cliente vai pagar
       public int? ChangeCents { get; set; }      // troco calculado

       [MaxLength(50)]
       public string? Coupon { get; set; } // Cupom de desconto (opcional)

       public int SubtotalCents { get; set; } // Subtotal do pedido (em centavos)
       public int DeliveryCents { get; set; } // Taxa de entrega (em centavos)
       public int TotalCents { get; set; } // Total do pedido (em centavos)

       public OrderStatus Status { get; set; } = OrderStatus.RECEBIDO; // Status do pedido

       public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow; // Data e hora de criação do pedido (UTC)
       public DateTime? UpdatedAtUtc { get; set; }
       public List<OrderItem> Items { get; set; } = new(); // Itens do pedido
    }
}