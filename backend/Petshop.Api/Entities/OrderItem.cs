using System.ComponentModel.DataAnnotations;
using Petshop.Api.Models;

namespace Petshop.Api.Entities
{
    public class OrderItem
    {
        public Guid Id { get; set; } = Guid.NewGuid(); // ID Técnico (PK)

        public Guid OrderId { get; set; } // ID do pedido (FK)

        public Order Order { get; set; } = default!; // Referência ao pedido

        public Guid ProductId { get; set; } // ID do produto (FK)
        public Product Product { get; set; } = default!; // Referência ao produto

        [MaxLength(150)]
        public string ProductNameSnapshot { get; set; } = ""; // Nome do produto (snapshot)

        public int UnitPriceCentsSnapshot { get; set; } // Preço unitário do produto (em centavos) (snapshot)
        public int Qty { get; set; } // Quantidade do produto no pedido

    }
}