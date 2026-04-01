using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Marketplace;

/// <summary>
/// Configuração de integração com um marketplace (iFood, etc.) para uma empresa.
/// Um cliente pode ter múltiplas integrações (ex: duas lojas no iFood).
/// </summary>
public class MarketplaceIntegration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    public MarketplaceType Type { get; set; }

    /// <summary>ID da loja/merchant no marketplace (ex: iFood merchantId).</summary>
    [MaxLength(100)]
    public string MerchantId { get; set; } = "";

    /// <summary>Nome amigável para identificar a integração no painel.</summary>
    [MaxLength(120)]
    public string DisplayName { get; set; } = "";

    /// <summary>OAuth2 clientId fornecido pelo portal do marketplace.</summary>
    [MaxLength(200)]
    public string ClientId { get; set; } = "";

    /// <summary>OAuth2 clientSecret (armazenado criptografado em produção via env var ou vault).</summary>
    [MaxLength(400)]
    public string ClientSecretEncrypted { get; set; } = "";

    /// <summary>
    /// Token de verificação do webhook (HMAC secret).
    /// Para iFood: não usado (assinatura via header X-IFood-Signature).
    /// Para outros: segredo para verificar payload.
    /// </summary>
    [MaxLength(200)]
    public string? WebhookSecret { get; set; }

    /// <summary>Aceitar pedidos automaticamente ao receber webhook (sem confirmação manual).</summary>
    public bool AutoAcceptOrders { get; set; } = true;

    /// <summary>Imprimir pedido automaticamente ao receber do marketplace.</summary>
    public bool AutoPrint { get; set; } = true;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastOrderReceivedAtUtc { get; set; }
    public DateTime? LastCatalogSyncAtUtc { get; set; }

    /// <summary>Último erro registrado (para diagnóstico no painel admin).</summary>
    [MaxLength(500)]
    public string? LastErrorMessage { get; set; }

    public ICollection<MarketplaceOrder> Orders { get; set; } = new List<MarketplaceOrder>();
}
