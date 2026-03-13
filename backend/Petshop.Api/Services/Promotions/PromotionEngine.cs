using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Promotions;

namespace Petshop.Api.Services.Promotions;

/// <summary>
/// Item de carrinho simplificado — o suficiente para calcular desconto.
/// </summary>
public record CartItem(
    Guid   ProductId,
    Guid   CategoryId,
    Guid?  BrandId,
    int    TotalCents   // já considerando qty
);

/// <summary>Resultado de avaliação de uma promoção individual.</summary>
public record PromotionResult(
    Guid   Id,
    string Name,
    string? Description,
    string? CouponCode,
    int    DiscountCents,
    bool   IsAutoApplied  // true = sem cupom, aplica automaticamente
);

/// <summary>
/// Avalia promoções ativas para um carrinho.
/// Regra: para promoções automáticas sem cupom, retorna todas que se aplicam.
/// Para promoções com cupom, avalia somente se o código for fornecido.
/// </summary>
public class PromotionEngine
{
    private readonly AppDbContext _db;

    public PromotionEngine(AppDbContext db) => _db = db;

    public async Task<List<PromotionResult>> EvaluateAsync(
        Guid             companyId,
        List<CartItem>   items,
        int              orderTotalCents,
        string?          couponCode,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var promos = await _db.Promotions.AsNoTracking()
            .Where(p => p.CompanyId == companyId &&
                        p.IsActive &&
                        (p.StartsAtUtc  == null || p.StartsAtUtc  <= now) &&
                        (p.ExpiresAtUtc == null || p.ExpiresAtUtc >= now))
            .ToListAsync(ct);

        var results = new List<PromotionResult>();

        foreach (var promo in promos)
        {
            // Filtra por cupom
            bool hasCoupon = !string.IsNullOrWhiteSpace(promo.CouponCode);
            if (hasCoupon)
            {
                if (string.IsNullOrWhiteSpace(couponCode)) continue;
                if (!string.Equals(promo.CouponCode, couponCode.Trim(), StringComparison.OrdinalIgnoreCase))
                    continue;
            }

            // Verifica mínimo de pedido
            if (promo.MinOrderCents.HasValue && orderTotalCents < promo.MinOrderCents.Value)
                continue;

            // Calcula base de aplicação (em centavos)
            int baseCents = promo.Scope switch
            {
                PromotionScope.All => orderTotalCents,
                PromotionScope.Category when promo.TargetId.HasValue =>
                    items.Where(i => i.CategoryId == promo.TargetId.Value).Sum(i => i.TotalCents),
                PromotionScope.Brand when promo.TargetId.HasValue =>
                    items.Where(i => i.BrandId == promo.TargetId.Value).Sum(i => i.TotalCents),
                PromotionScope.Product when promo.TargetId.HasValue =>
                    items.Where(i => i.ProductId == promo.TargetId.Value).Sum(i => i.TotalCents),
                _ => 0
            };

            if (baseCents <= 0) continue;

            // Calcula desconto
            int discount = promo.Type switch
            {
                PromotionType.PercentDiscount =>
                    (int)Math.Floor(baseCents * (double)promo.Value / 100.0),
                PromotionType.FixedAmount =>
                    (int)promo.Value,
                _ => 0
            };

            // Aplica teto
            if (promo.MaxDiscountCents.HasValue)
                discount = Math.Min(discount, promo.MaxDiscountCents.Value);

            // Desconto não pode exceder a base
            discount = Math.Min(discount, baseCents);

            if (discount <= 0) continue;

            results.Add(new PromotionResult(
                promo.Id,
                promo.Name,
                promo.Description,
                promo.CouponCode,
                discount,
                !hasCoupon
            ));
        }

        // Ordena: automáticas primeiro, depois maior desconto
        return results
            .OrderByDescending(r => r.IsAutoApplied)
            .ThenByDescending(r => r.DiscountCents)
            .ToList();
    }

    /// <summary>
    /// Avalia promoções para um total simples sem breakdown de itens (acesso PDV sem carrinho completo).
    /// </summary>
    public Task<List<PromotionResult>> EvaluateSimpleAsync(
        Guid companyId, int orderTotalCents, string? couponCode, CancellationToken ct)
    {
        var fakeItems = new List<CartItem>(); // sem items = só promos Scope.All
        return EvaluateAsync(companyId, fakeItems, orderTotalCents, couponCode, ct);
    }
}
