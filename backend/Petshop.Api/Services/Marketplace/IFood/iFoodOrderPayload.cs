using System.Text.Json.Serialization;

namespace Petshop.Api.Services.Marketplace.IFood;

/// <summary>
/// DTOs que espelham o payload de pedido recebido via webhook/polling do iFood.
/// Apenas os campos necessários para criação do Order interno são mapeados.
/// </summary>
public sealed class iFoodOrderPayload
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("reference")]
    public string? Reference { get; set; }

    [JsonPropertyName("shortReference")]
    public string? ShortReference { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = "DELIVERY"; // DELIVERY | TAKEOUT | INDOOR

    [JsonPropertyName("merchant")]
    public iFoodMerchant? Merchant { get; set; }

    [JsonPropertyName("customer")]
    public iFoodCustomer? Customer { get; set; }

    [JsonPropertyName("items")]
    public List<iFoodItem> Items { get; set; } = new();

    [JsonPropertyName("otherFees")]
    public List<iFoodFee>? OtherFees { get; set; }

    [JsonPropertyName("payments")]
    public iFoodPayments? Payments { get; set; }

    [JsonPropertyName("delivery")]
    public iFoodDelivery? Delivery { get; set; }

    [JsonPropertyName("total")]
    public iFoodTotal? Total { get; set; }
}

public sealed class iFoodMerchant
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";
}

public sealed class iFoodCustomer
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("documentNumber")]
    public string? DocumentNumber { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }
}

public sealed class iFoodItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }

    [JsonPropertyName("unitPrice")]
    public iFoodMoney? UnitPrice { get; set; }

    [JsonPropertyName("totalPrice")]
    public iFoodMoney? TotalPrice { get; set; }

    [JsonPropertyName("externalCode")]
    public string? ExternalCode { get; set; }  // código do produto no cardápio iFood

    [JsonPropertyName("options")]
    public List<iFoodItemOption>? Options { get; set; }  // adicionais/complementos
}

public sealed class iFoodItemOption
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }

    [JsonPropertyName("unitPrice")]
    public iFoodMoney? UnitPrice { get; set; }

    [JsonPropertyName("externalCode")]
    public string? ExternalCode { get; set; }
}

public sealed class iFoodFee
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("amount")]
    public iFoodMoney? Amount { get; set; }
}

public sealed class iFoodPayments
{
    [JsonPropertyName("prepaid")]
    public decimal Prepaid { get; set; }

    [JsonPropertyName("pending")]
    public decimal Pending { get; set; }

    [JsonPropertyName("methods")]
    public List<iFoodPaymentMethod>? Methods { get; set; }
}

public sealed class iFoodPaymentMethod
{
    [JsonPropertyName("method")]
    public string Method { get; set; } = "";

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("value")]
    public decimal Value { get; set; }

    [JsonPropertyName("cash")]
    public iFoodCash? Cash { get; set; }
}

public sealed class iFoodCash
{
    [JsonPropertyName("changeFor")]
    public decimal ChangeFor { get; set; }
}

public sealed class iFoodDelivery
{
    [JsonPropertyName("deliveryAddress")]
    public iFoodAddress? DeliveryAddress { get; set; }

    [JsonPropertyName("estimatedTimeMinutes")]
    public int? EstimatedTimeMinutes { get; set; }
}

public sealed class iFoodAddress
{
    [JsonPropertyName("streetName")]
    public string? StreetName { get; set; }

    [JsonPropertyName("streetNumber")]
    public string? StreetNumber { get; set; }

    [JsonPropertyName("complement")]
    public string? Complement { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("city")]
    public iFoodCity? City { get; set; }

    [JsonPropertyName("postalCode")]
    public string? PostalCode { get; set; }

    [JsonPropertyName("latitude")]
    public decimal? Latitude { get; set; }

    [JsonPropertyName("longitude")]
    public decimal? Longitude { get; set; }
}

public sealed class iFoodCity
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }
}

public sealed class iFoodTotal
{
    [JsonPropertyName("subTotal")]
    public decimal SubTotal { get; set; }

    [JsonPropertyName("deliveryFee")]
    public decimal DeliveryFee { get; set; }

    [JsonPropertyName("benefits")]
    public decimal Benefits { get; set; }

    [JsonPropertyName("orderAmount")]
    public decimal OrderAmount { get; set; }
}

public sealed class iFoodMoney
{
    [JsonPropertyName("value")]
    public decimal Value { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "BRL";
}

/// <summary>Payload do evento de webhook iFood (envelope externo).</summary>
public sealed class iFoodWebhookEvent
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("code")]
    public string Code { get; set; } = ""; // PLC, CFM, CAN, etc.

    [JsonPropertyName("fullCode")]
    public string FullCode { get; set; } = "";

    [JsonPropertyName("orderId")]
    public string OrderId { get; set; } = "";

    [JsonPropertyName("merchantId")]
    public string MerchantId { get; set; } = "";

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}
