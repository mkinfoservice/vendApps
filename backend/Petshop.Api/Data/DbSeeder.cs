using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Models;

namespace Petshop.Api.Data;

public static class DbSeeder
{
    /// <summary>GUID fixo da empresa demo (dev). Também referenciado em appsettings.json → Jwt:CompanyId.</summary>
    public static readonly Guid DevCompanyId = new("11111111-0000-0000-0000-000000000001");

    /// <summary>GUID fixo da empresa demo "suaempresa" (apresentação para clientes).</summary>
    public static readonly Guid DemoCompanyId = new("22222222-0000-0000-0000-000000000002");

    /// <summary>GUID fixo da empresa demo "novaempresa" (testes de onboarding).</summary>
    public static readonly Guid NovaEmpresaId = new("33333333-0000-0000-0000-000000000003");

    public static async Task SeedAsync(AppDbContext db)
    {
        await db.Database.MigrateAsync();

        await SeedCompanyAsync(
            db,
            id:      DevCompanyId,
            name:    "Petshop Demo",
            slug:    "petshop-demo",
            segment: "petshop",
            seeder:  SeedPetshopDemoAsync);

        await SeedCompanyAsync(
            db,
            id:      DemoCompanyId,
            name:    "Sua Empresa",
            slug:    "suaempresa",
            segment: "petshop",
            seeder:  SeedSuaEmpresaAsync);

        await SeedCompanyAsync(
            db,
            id:      NovaEmpresaId,
            name:    "Empresa Teste",
            slug:    "novaempresa",
            segment: "petshop",
            seeder:  SeedNovaEmpresaAsync);
    }

    // ── Core ─────────────────────────────────────────────────────────────────

    private static async Task SeedCompanyAsync(
        AppDbContext db,
        Guid id,
        string name,
        string slug,
        string segment,
        Func<AppDbContext, Guid, Task> seeder)
    {
        if (!await db.Companies.AnyAsync(c => c.Slug == slug))
        {
            db.Companies.Add(new Company
            {
                Id = id,
                Name = name,
                Slug = slug,
                Segment = segment,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        if (!await db.Categories.AnyAsync(c => c.CompanyId == id))
            await seeder(db, id);
    }

    // ── petshop-demo ─────────────────────────────────────────────────────────

    private static async Task SeedPetshopDemoAsync(AppDbContext db, Guid companyId)
    {
        var categories = new List<Category>
        {
            new() { Name = "Ração",      Slug = "racao",      CompanyId = companyId },
            new() { Name = "Petiscos",   Slug = "petiscos",   CompanyId = companyId },
            new() { Name = "Remédios",   Slug = "remedios",   CompanyId = companyId },
            new() { Name = "Acessórios", Slug = "acessorios", CompanyId = companyId },
            new() { Name = "Higiene",    Slug = "higiene",    CompanyId = companyId },
        };

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;

        var products = new List<Product>
        {
            new() { Name = "Ração Premium para Cães",       Slug = "racao-premium-caes",       PriceCents = 19990, CostCents = 12000, StockQty = 50,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/dogfood/800/600"  },
            new() { Name = "Petiscos Naturais para Cães",   Slug = "petiscos-naturais-caes",   PriceCents =  4990, CostCents =  2500, StockQty = 100, Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/treats/800/600"   },
            new() { Name = "Remédio Antipulgas para Cães",  Slug = "remedio-antipulgas-caes",  PriceCents = 29990, CostCents = 18000, StockQty = 30,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/flea/800/600"     },
            new() { Name = "Coleira Ajustável para Cães",   Slug = "coleira-ajustavel-caes",   PriceCents = 15990, CostCents =  8000, StockQty = 20,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/collar/800/600"   },
            new() { Name = "Shampoo Hipoalergênico para Cães", Slug = "shampoo-hipoalergenico-caes", PriceCents = 3990, CostCents = 1800, StockQty = 60, Unit = "UN", CategoryId = Cat("higiene"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/shampoo/800/600" },
        };

        ApplyMargins(products);
        db.Products.AddRange(products);
        await db.SaveChangesAsync();
    }

    // ── suaempresa ────────────────────────────────────────────────────────────

    private static async Task SeedSuaEmpresaAsync(AppDbContext db, Guid companyId)
    {
        var categories = new List<Category>
        {
            new() { Name = "Ração",      Slug = "racao",      CompanyId = companyId },
            new() { Name = "Petiscos",   Slug = "petiscos",   CompanyId = companyId },
            new() { Name = "Remédios",   Slug = "remedios",   CompanyId = companyId },
            new() { Name = "Acessórios", Slug = "acessorios", CompanyId = companyId },
            new() { Name = "Higiene",    Slug = "higiene",    CompanyId = companyId },
        };

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;

        var products = new List<Product>
        {
            new() { Name = "Ração Royal Canin Adulto",       Slug = "racao-royal-canin-adulto",       PriceCents = 24990, CostCents = 16000, StockQty = 40,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/royalcanin/800/600"   },
            new() { Name = "Ração Hills Science Diet",       Slug = "racao-hills-science-diet",       PriceCents = 31990, CostCents = 20000, StockQty = 25,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/hillscat/800/600"     },
            new() { Name = "Petisco Ossinho Dental",         Slug = "petisco-ossinho-dental",         PriceCents =  3990, CostCents =  1800, StockQty = 80,  Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/dentalbone/800/600"   },
            new() { Name = "Petisco Bifinho Frango",         Slug = "petisco-bifinho-frango",         PriceCents =  5490, CostCents =  2700, StockQty = 120, Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/chickentreats/800/600"},
            new() { Name = "Frontline Antipulgas Top Spot",  Slug = "frontline-antipulgas-top-spot",  PriceCents = 34990, CostCents = 22000, StockQty = 20,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/frontline/800/600"    },
            new() { Name = "Vermífugo Drontal Plus",         Slug = "vermifugo-drontal-plus",         PriceCents =  8990, CostCents =  5000, StockQty = 35,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/drontal/800/600"      },
            new() { Name = "Coleira Antiparasitária Seresto",Slug = "coleira-antiparasitaria-seresto",PriceCents = 17990, CostCents = 10000, StockQty = 15,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/seresto/800/600"      },
            new() { Name = "Cama Pet Confort M",             Slug = "cama-pet-confort-m",             PriceCents = 12990, CostCents =  7000, StockQty = 10,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/petbed/800/600"       },
            new() { Name = "Shampoo Neutro Sanol Dog",       Slug = "shampoo-neutro-sanol-dog",       PriceCents =  2990, CostCents =  1400, StockQty = 55,  Unit = "UN", CategoryId = Cat("higiene"),    CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/sanoldog/800/600"     },
            new() { Name = "Condicionador Hydra Pro Pet",    Slug = "condicionador-hydra-pro-pet",    PriceCents =  4490, CostCents =  2200, StockQty = 45,  Unit = "UN", CategoryId = Cat("higiene"),    CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/hydrapro/800/600"     },
        };

        ApplyMargins(products);
        db.Products.AddRange(products);
        await db.SaveChangesAsync();
    }

    // ── novaempresa ───────────────────────────────────────────────────────────

    private static async Task SeedNovaEmpresaAsync(AppDbContext db, Guid companyId)
    {
        var categories = new List<Category>
        {
            new() { Name = "Ração",      Slug = "racao",      CompanyId = companyId },
            new() { Name = "Petiscos",   Slug = "petiscos",   CompanyId = companyId },
            new() { Name = "Remédios",   Slug = "remedios",   CompanyId = companyId },
            new() { Name = "Acessórios", Slug = "acessorios", CompanyId = companyId },
            new() { Name = "Higiene",    Slug = "higiene",    CompanyId = companyId },
        };

        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Guid Cat(string slug) => categories.First(c => c.Slug == slug).Id;

        var products = new List<Product>
        {
            new() { Name = "Ração Golden Adulto Frango",      Slug = "racao-golden-adulto-frango",      PriceCents = 18990, CostCents = 11000, StockQty = 45,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/golden1/800/600"    },
            new() { Name = "Ração Purina Pro Plan Cão",       Slug = "racao-purina-pro-plan-cao",       PriceCents = 27990, CostCents = 17000, StockQty = 30,  Unit = "UN", CategoryId = Cat("racao"),      CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/purina1/800/600"    },
            new() { Name = "Petisco Snack Funcional",         Slug = "petisco-snack-funcional",         PriceCents =  4490, CostCents =  2100, StockQty = 90,  Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/snack1/800/600"     },
            new() { Name = "Petisco Palito de Couro",         Slug = "petisco-palito-de-couro",         PriceCents =  2990, CostCents =  1300, StockQty = 110, Unit = "UN", CategoryId = Cat("petiscos"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/couro1/800/600"     },
            new() { Name = "Antipulgas Advantage Cães",       Slug = "antipulgas-advantage-caes",       PriceCents = 32990, CostCents = 20000, StockQty = 18,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/advantage1/800/600" },
            new() { Name = "Suplemento Condroitina Joint",    Slug = "suplemento-condroitina-joint",    PriceCents = 11990, CostCents =  7000, StockQty = 25,  Unit = "UN", CategoryId = Cat("remedios"),   CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/joint1/800/600"     },
            new() { Name = "Guia Retrátil 5m",                Slug = "guia-retratil-5m",                PriceCents =  9990, CostCents =  5500, StockQty = 22,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/guia1/800/600"      },
            new() { Name = "Comedouro Inox Duplo",             Slug = "comedouro-inox-duplo",            PriceCents =  7990, CostCents =  4000, StockQty = 35,  Unit = "UN", CategoryId = Cat("acessorios"), CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/inox1/800/600"      },
            new() { Name = "Shampoo Seco Spray Pet",          Slug = "shampoo-seco-spray-pet",          PriceCents =  3490, CostCents =  1600, StockQty = 50,  Unit = "UN", CategoryId = Cat("higiene"),    CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/spray1/800/600"     },
            new() { Name = "Escova Dental Pet Kit",           Slug = "escova-dental-pet-kit",           PriceCents =  2490, CostCents =  1100, StockQty = 60,  Unit = "UN", CategoryId = Cat("higiene"),    CompanyId = companyId, ImageUrl = "https://picsum.photos/seed/dental1/800/600"    },
        };

        ApplyMargins(products);
        db.Products.AddRange(products);
        await db.SaveChangesAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void ApplyMargins(IEnumerable<Product> products)
    {
        foreach (var p in products)
        {
            if (p.PriceCents > 0)
                p.MarginPercent = Math.Round((decimal)(p.PriceCents - p.CostCents) / p.PriceCents * 100, 2);
        }
    }
}
