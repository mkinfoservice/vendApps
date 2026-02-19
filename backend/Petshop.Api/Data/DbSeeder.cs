using Microsoft.EntityFrameworkCore;
using Petshop.Api.Models;

namespace Petshop.Api.Data;

/// <summary>
/// Seed do banco (dev)
/// - Cria categorias e produtos iniciais
/// - Pode ser executado várias vezes sem duplicar dados
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // Garante que o banco e migrations estão aplicadas
        await db.Database.MigrateAsync();

        // Se já tem categorias, não precisa semear de novo
        if (await db.Categories.AnyAsync())
            return;

        var categories = new List<Category>
        {
            new Category { Name = "Ração", Slug = "racao" },
            new Category { Name = "Petiscos", Slug = "petiscos" },
            new Category { Name = "Remédios", Slug = "remedios" },
            new Category { Name = "Acessórios", Slug = "acessorios" },
            new Category { Name = "Higiene", Slug = "higiene" },
        };

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        //Helper: Pega o Id da categoria pelo slug
        Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;
        
        var products = new List<Product>
        {
            new Product { Name = "Ração Premium para Cães", Slug = "racao-premium-caes", PriceCents = 19990, CategoryId = Cat("racao"), ImageUrl = "https://picsum.photos/seed/dogfood/800/600" },
            new Product { Name = "Petiscos Naturais para Cães", Slug = "petiscos-naturais-caes", PriceCents = 4990, CategoryId = Cat("petiscos"), ImageUrl = "https://picsum.photos/seed/treats/800/600" },
            new Product { Name = "Remédio Antipulgas para Cães", Slug = "remedio-antipulgas-caes", PriceCents = 29990, CategoryId = Cat("remedios"), ImageUrl = "https://picsum.photos/seed/flea/800/600" },
            new Product { Name = "Coleira Ajustável para Cães", Slug = "coleira-ajustavel-caes", PriceCents = 15990, CategoryId = Cat("acessorios"), ImageUrl = "https://picsum.photos/seed/collar/800/600" },
            new Product { Name = "Shampoo Hipoalergênico para Cães", Slug = "shampoo-hipoalergenico-caes", PriceCents = 3990, CategoryId = Cat("higiene"), ImageUrl = "https://picsum.photos/seed/shampoo/800/600" },
        };

        db.Products.AddRange(products);
        await db.SaveChangesAsync();
    }
}