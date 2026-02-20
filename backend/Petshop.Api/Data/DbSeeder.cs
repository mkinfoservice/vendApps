using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Models;

namespace Petshop.Api.Data;

public static class DbSeeder
{
    /// <summary>GUID fixo da empresa demo (dev). Também referenciado em appsettings.json → Jwt:CompanyId.</summary>
    public static readonly Guid DevCompanyId = new("11111111-0000-0000-0000-000000000001");

    public static async Task SeedAsync(AppDbContext db)
    {
        await db.Database.MigrateAsync();

        // ── Company ──────────────────────────────────────────────────────────
        if (!await db.Companies.AnyAsync())
        {
            db.Companies.Add(new Company
            {
                Id = DevCompanyId,
                Name = "Petshop Demo",
                Slug = "petshop-demo",
                Segment = "petshop",
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // ── Categorias ───────────────────────────────────────────────────────
        if (await db.Categories.AnyAsync())
            return;

        var categories = new List<Category>
        {
            new() { Name = "Ração",       Slug = "racao",      CompanyId = DevCompanyId },
            new() { Name = "Petiscos",    Slug = "petiscos",   CompanyId = DevCompanyId },
            new() { Name = "Remédios",    Slug = "remedios",   CompanyId = DevCompanyId },
            new() { Name = "Acessórios",  Slug = "acessorios", CompanyId = DevCompanyId },
            new() { Name = "Higiene",     Slug = "higiene",    CompanyId = DevCompanyId },
        };

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;

        var products = new List<Product>
        {
            new()
            {
                Name = "Ração Premium para Cães",
                Slug = "racao-premium-caes",
                PriceCents = 19990,
                CostCents = 12000,
                StockQty = 50,
                Unit = "UN",
                CategoryId = Cat("racao"),
                CompanyId = DevCompanyId,
                ImageUrl = "https://picsum.photos/seed/dogfood/800/600"
            },
            new()
            {
                Name = "Petiscos Naturais para Cães",
                Slug = "petiscos-naturais-caes",
                PriceCents = 4990,
                CostCents = 2500,
                StockQty = 100,
                Unit = "UN",
                CategoryId = Cat("petiscos"),
                CompanyId = DevCompanyId,
                ImageUrl = "https://picsum.photos/seed/treats/800/600"
            },
            new()
            {
                Name = "Remédio Antipulgas para Cães",
                Slug = "remedio-antipulgas-caes",
                PriceCents = 29990,
                CostCents = 18000,
                StockQty = 30,
                Unit = "UN",
                CategoryId = Cat("remedios"),
                CompanyId = DevCompanyId,
                ImageUrl = "https://picsum.photos/seed/flea/800/600"
            },
            new()
            {
                Name = "Coleira Ajustável para Cães",
                Slug = "coleira-ajustavel-caes",
                PriceCents = 15990,
                CostCents = 8000,
                StockQty = 20,
                Unit = "UN",
                CategoryId = Cat("acessorios"),
                CompanyId = DevCompanyId,
                ImageUrl = "https://picsum.photos/seed/collar/800/600"
            },
            new()
            {
                Name = "Shampoo Hipoalergênico para Cães",
                Slug = "shampoo-hipoalergenico-caes",
                PriceCents = 3990,
                CostCents = 1800,
                StockQty = 60,
                Unit = "UN",
                CategoryId = Cat("higiene"),
                CompanyId = DevCompanyId,
                ImageUrl = "https://picsum.photos/seed/shampoo/800/600"
            },
        };

        foreach (var p in products)
        {
            if (p.PriceCents > 0)
                p.MarginPercent = Math.Round((decimal)(p.PriceCents - p.CostCents) / p.PriceCents * 100, 2);
        }

        db.Products.AddRange(products);
        await db.SaveChangesAsync();
    }
}
