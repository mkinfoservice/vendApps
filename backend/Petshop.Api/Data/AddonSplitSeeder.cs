using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities.Catalog;
using System.Text.RegularExpressions;

namespace Petshop.Api.Data;

/// <summary>
/// Seeder idempotente: desmembra adicionais com múltiplas opções combinadas em um único nome
/// (ex: "Cobertura (caramelo ou chocolate)") em registros individuais.
/// Regra geral: qualquer nome com " ou " é candidato ao split.
/// Exemplo:
///   "Cobertura (caramelo ou chocolate)"  →  "Caramelo"  +  "Chocolate"
///   "Syrup (baunilha ou caramelo)"       →  "Baunilha"  +  "Caramelo"
/// O nome do grupo já fornece o contexto; os filhos ficam com nomes curtos.
/// </summary>
public static class AddonSplitSeeder
{
    // Detecta " ou " dentro de parênteses: "X (A ou B)" → groups: prefix="X", inner="A ou B"
    private static readonly Regex ParenOrPattern =
        new(@"^(.+?)\s*\((.+\s+ou\s+.+)\)\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Detecta " ou " livre: "A ou B"
    private static readonly Regex PlainOrPattern =
        new(@"^(.+?)\s+ou\s+(.+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope  = services.CreateScope();
        var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        try
        {
            // Busca adicionais com " ou " no nome (candidatos ao split)
            var candidates = await db.ProductAddons
                .Where(a => a.IsActive && a.Name.ToLower().Contains(" ou "))
                .OrderBy(a => a.SortOrder)
                .ToListAsync();

            if (candidates.Count == 0)
            {
                logger.LogDebug("AddonSplitSeeder: nenhum adicional combinado encontrado.");
                return;
            }

            logger.LogInformation("AddonSplitSeeder: {Count} adicional(is) combinado(s) para desmembrar.", candidates.Count);

            foreach (var addon in candidates)
            {
                var parts = ExtractParts(addon.Name);
                if (parts is null || parts.Count < 2) continue;

                // Já foi desmembrado em execução anterior? Verifica se algum dos filhos já existe
                // (mesmo ProductId, mesmo AddonGroupId, nome == primeira parte)
                var alreadyDone = await db.ProductAddons.AnyAsync(a =>
                    a.ProductId   == addon.ProductId &&
                    a.AddonGroupId == addon.AddonGroupId &&
                    a.Name        == parts[0] &&
                    a.Id          != addon.Id);

                if (alreadyDone)
                {
                    logger.LogDebug("AddonSplitSeeder: '{Name}' já foi desmembrado — pulando.", addon.Name);
                    continue;
                }

                logger.LogInformation("AddonSplitSeeder: desmembrando '{Name}' → {Parts}", addon.Name, string.Join(", ", parts));

                // Cria um novo addon para cada parte
                for (int i = 0; i < parts.Count; i++)
                {
                    db.ProductAddons.Add(new ProductAddon
                    {
                        ProductId    = addon.ProductId,
                        AddonGroupId = addon.AddonGroupId,
                        Name         = parts[i],
                        PriceCents   = addon.PriceCents,
                        SortOrder    = addon.SortOrder + i,
                        IsActive     = true,
                        IsDefault    = false,
                    });
                }

                // Desativa o original combinado (não remove para não quebrar histórico)
                addon.IsActive = false;
            }

            await db.SaveChangesAsync();
            logger.LogInformation("AddonSplitSeeder: concluído.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AddonSplitSeeder: falha (não crítico).");
        }
    }

    /// <summary>
    /// Extrai as partes individuais de um nome combinado.
    /// "Cobertura (caramelo ou chocolate)" → ["Caramelo", "Chocolate"]
    /// "Baunilha ou Caramelo"              → ["Baunilha", "Caramelo"]
    /// </summary>
    private static List<string>? ExtractParts(string name)
    {
        // Tenta padrão com parênteses: "Prefixo (A ou B)"
        var m = ParenOrPattern.Match(name);
        if (m.Success)
        {
            var inner = m.Groups[2].Value;
            return inner
                .Split(" ou ", StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(Capitalize)
                .ToList();
        }

        // Tenta padrão livre: "A ou B"
        m = PlainOrPattern.Match(name);
        if (m.Success)
        {
            return new List<string>
            {
                Capitalize(m.Groups[1].Value.Trim()),
                Capitalize(m.Groups[2].Value.Trim()),
            };
        }

        return null;
    }

    private static string Capitalize(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return s;
        s = s.Trim();
        return char.ToUpperInvariant(s[0]) + s[1..];
    }
}
