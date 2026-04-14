using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Data;

/// <summary>
/// Seeder idempotente: para cada produto que tem adicionais mas nenhum grupo configurado,
/// classifica os adicionais por padrão de nome e cria os grupos na sequência definida:
///   0 · Sabor        — opções gratuitas (ex: Natural, Baunilha) — single
///   1 · Tipo de Leite — leite integral, sem lactose, aveia      — single, IsDefault no integral
///   2 · Cobertura     — coberturas, chantilly                   — single
///   3 · Extras        — marshmallow, dose de café, outros       — multiple
/// </summary>
public static class AddonGroupSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope  = services.CreateScope();
        var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        try
        {
            // Produtos que têm adicionais MAS ainda não têm grupos configurados
            var productIdsWithAddons = await db.ProductAddons
                .Where(a => a.IsActive)
                .Select(a => a.ProductId)
                .Distinct()
                .ToListAsync();

            var productIdsWithGroups = await db.ProductAddonGroups
                .Select(g => g.ProductId)
                .Distinct()
                .ToListAsync();

            var toSeed = productIdsWithAddons
                .Except(productIdsWithGroups)
                .ToList();

            if (toSeed.Count == 0)
            {
                logger.LogDebug("AddonGroupSeeder: nenhum produto pendente.");
                return;
            }

            logger.LogInformation("AddonGroupSeeder: organizando {Count} produto(s) sem grupos.", toSeed.Count);

            foreach (var productId in toSeed)
            {
                var addons = await db.ProductAddons
                    .Where(a => a.ProductId == productId && a.IsActive)
                    .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
                    .ToListAsync();

                if (addons.Count == 0) continue;

                // ── Classifica cada adicional ─────────────────────────────────
                var buckets = new Dictionary<string, List<ProductAddon>>
                {
                    ["Sabor"]         = new(),
                    ["Tipo de Leite"] = new(),
                    ["Cobertura"]     = new(),
                    ["Extras"]        = new(),
                };

                foreach (var addon in addons)
                    buckets[Classify(addon.Name, addon.PriceCents)].Add(addon);

                // Remove buckets vazios e define a ordem
                var groupDefs = new (string Name, string Type, int Sort, bool Single)[]
                {
                    ("Sabor",         "single",   0, true),
                    ("Tipo de Leite", "single",   1, true),
                    ("Cobertura",     "single",   2, true),
                    ("Extras",        "multiple", 3, false),
                };

                foreach (var (groupName, selType, sortOrder, isSingle) in groupDefs)
                {
                    var members = buckets[groupName];
                    if (members.Count == 0) continue;

                    // Para Tipo de Leite: coloca "integral" ou "(padrão)" primeiro
                    if (groupName == "Tipo de Leite")
                    {
                        members = members
                            .OrderByDescending(a =>
                                a.Name.Contains("integral", StringComparison.OrdinalIgnoreCase) ||
                                a.Name.Contains("padrão",   StringComparison.OrdinalIgnoreCase) ||
                                a.Name.Contains("padrao",   StringComparison.OrdinalIgnoreCase))
                            .ThenBy(a => a.SortOrder)
                            .ThenBy(a => a.Name)
                            .ToList();
                    }

                    var group = new ProductAddonGroup
                    {
                        ProductId     = productId,
                        Name          = groupName,
                        IsRequired    = false,
                        SelectionType = selType,
                        MinSelections = 0,
                        MaxSelections = isSingle ? 1 : 0,
                        SortOrder     = sortOrder,
                    };
                    db.ProductAddonGroups.Add(group);

                    // Associa adicionais ao grupo e ajusta sort order
                    for (int i = 0; i < members.Count; i++)
                    {
                        var addon = members[i];
                        addon.AddonGroupId = group.Id;
                        addon.SortOrder    = i;

                        // Marca o primeiro do Tipo de Leite como default
                        if (groupName == "Tipo de Leite" && i == 0)
                            addon.IsDefault = true;
                    }
                }
            }

            await db.SaveChangesAsync();
            logger.LogInformation("AddonGroupSeeder: concluído.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AddonGroupSeeder: falha (não crítico — aplicação continua).");
        }
    }

    // ── Regras de classificação ───────────────────────────────────────────────

    private static string Classify(string name, int priceCents)
    {
        var n = name.ToLowerInvariant();

        // Tipo de Leite — palavras-chave leitosas
        if (n.Contains("leite")    ||
            n.Contains("lactose")  ||
            n.Contains("aveia")    ||
            n.Contains("integral") ||
            n.Contains("desnatad") ||
            n.Contains("soja")     ||
            n.Contains("coco"))
            return "Tipo de Leite";

        // Cobertura — coberturas e toppings cremosos
        if (n.Contains("cobertura") ||
            n.Contains("chantilly") ||
            n.Contains("ganache")   ||
            n.Contains("calda"))
            return "Cobertura";

        // Sabor — opções gratuitas curtas (ex: Natural, Baunilha, Romã)
        // Não cai aqui se já for leite ou cobertura
        if (priceCents == 0)
            return "Sabor";

        // Tudo mais → Extras
        return "Extras";
    }
}
