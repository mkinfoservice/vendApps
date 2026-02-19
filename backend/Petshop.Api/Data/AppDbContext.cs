using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities;
using Petshop.Api.Models;
using DeliveryRoute = Petshop.Api.Entities.Delivery.Route;
using Petshop.Api.Entities.Delivery;
namespace Petshop.Api.Data;


/// <summary>
/// DbContext:
/// - Centraliza as tabelas (DbSets)
/// - Configura relacionamento/índices
/// - É a “ponte” do EF Core com o Postgres
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Deliverer> Deliverers => Set<Deliverer>();
    public DbSet<DeliveryRoute> Routes => Set<DeliveryRoute>();
    public DbSet<RouteStop> RouteStops => Set<RouteStop>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuração do Order
        modelBuilder.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId);

        // Configuração do OrderItem
        modelBuilder.Entity<OrderItem>()
            .HasOne(i => i.Product)
            .WithMany() // sem navegação inversa por enquanto
            .HasForeignKey(i => i.ProductId);


        // Category.Slug único (evita duplicar "racao")
        modelBuilder.Entity<Category>()
            .HasIndex(c => c.Slug)
            .IsUnique();

        // Product.Slug único (URL amigável)
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Slug)
            .IsUnique();
        // Order.PublicId único (ID humano do pedido)
        modelBuilder.Entity<Order>()
            .HasIndex(o => o.PublicId)
            .IsUnique();

        // Relacionamento 1:N Category -> Products
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId);
    }
}
