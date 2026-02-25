using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Audit;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Master;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Models;
using DeliveryRoute = Petshop.Api.Entities.Delivery.Route;
using Petshop.Api.Entities.Delivery;

namespace Petshop.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── Tenant ───────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();

    // ── Catálogo ─────────────────────────────────────────────
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    // ── Pedidos ──────────────────────────────────────────────
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    // ── Entrega ──────────────────────────────────────────────
    public DbSet<Deliverer> Deliverers => Set<Deliverer>();
    public DbSet<DeliveryRoute> Routes => Set<DeliveryRoute>();
    public DbSet<RouteStop> RouteStops => Set<RouteStop>();

    // ── Sync ─────────────────────────────────────────────────
    public DbSet<ExternalSource> ExternalSources => Set<ExternalSource>();
    public DbSet<ExternalProductSnapshot> ExternalProductSnapshots => Set<ExternalProductSnapshot>();
    public DbSet<ProductSyncJob> ProductSyncJobs => Set<ProductSyncJob>();
    public DbSet<ProductSyncItem> ProductSyncItems => Set<ProductSyncItem>();

    // ── Auditoria ────────────────────────────────────────────
    public DbSet<ProductChangeLog> ProductChangeLogs => Set<ProductChangeLog>();
    public DbSet<ProductPriceHistory> ProductPriceHistories => Set<ProductPriceHistory>();

    // ── Master Admin ──────────────────────────────────────────
    public DbSet<CompanySettings> CompanySettings => Set<CompanySettings>();
    public DbSet<CompanyIntegrationWhatsapp> CompanyIntegrationsWhatsapp => Set<CompanyIntegrationWhatsapp>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<MasterAuditLog> MasterAuditLogs => Set<MasterAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Company ──────────────────────────────────────────
        modelBuilder.Entity<Company>()
            .HasIndex(c => c.Slug)
            .IsUnique();

        // ── Category ─────────────────────────────────────────
        modelBuilder.Entity<Category>()
            .HasIndex(c => new { c.CompanyId, c.Slug })
            .IsUnique();

        modelBuilder.Entity<Category>()
            .HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // ── Brand ────────────────────────────────────────────
        modelBuilder.Entity<Brand>()
            .HasIndex(b => new { b.CompanyId, b.Slug })
            .IsUnique();

        modelBuilder.Entity<Brand>()
            .HasOne(b => b.Company)
            .WithMany()
            .HasForeignKey(b => b.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // ── Product ──────────────────────────────────────────
        modelBuilder.Entity<Product>()
            .HasIndex(p => new { p.CompanyId, p.Slug })
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Company)
            .WithMany()
            .HasForeignKey(p => p.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Brand)
            .WithMany()
            .HasForeignKey(p => p.BrandId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Concurrency token
        modelBuilder.Entity<Product>()
            .Property(p => p.RowVersion)
            .IsRowVersion();

        // ── ProductVariant ────────────────────────────────────
        modelBuilder.Entity<ProductVariant>()
            .HasOne(v => v.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ProductImage ──────────────────────────────────────
        modelBuilder.Entity<ProductImage>()
            .HasOne(i => i.Product)
            .WithMany(p => p.Images)
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Order ────────────────────────────────────────────
        modelBuilder.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId);

        modelBuilder.Entity<Order>()
            .HasIndex(o => o.PublicId)
            .IsUnique();

        // ── OrderItem ─────────────────────────────────────────
        modelBuilder.Entity<OrderItem>()
            .HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // ── ExternalSource ────────────────────────────────────
        modelBuilder.Entity<ExternalSource>()
            .HasOne(s => s.Company)
            .WithMany()
            .HasForeignKey(s => s.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ExternalProductSnapshot ───────────────────────────
        modelBuilder.Entity<ExternalProductSnapshot>()
            .HasIndex(s => new { s.CompanyId, s.ExternalSourceId, s.ExternalId })
            .IsUnique();

        modelBuilder.Entity<ExternalProductSnapshot>()
            .HasOne(s => s.ExternalSource)
            .WithMany()
            .HasForeignKey(s => s.ExternalSourceId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ProductSyncJob ────────────────────────────────────
        modelBuilder.Entity<ProductSyncJob>()
            .HasOne(j => j.Company)
            .WithMany()
            .HasForeignKey(j => j.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProductSyncJob>()
            .HasOne(j => j.ExternalSource)
            .WithMany()
            .HasForeignKey(j => j.ExternalSourceId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ProductSyncItem ───────────────────────────────────
        modelBuilder.Entity<ProductSyncItem>()
            .HasOne(i => i.Job)
            .WithMany(j => j.Items)
            .HasForeignKey(i => i.JobId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ProductChangeLog ──────────────────────────────────
        modelBuilder.Entity<ProductChangeLog>()
            .HasOne(l => l.Product)
            .WithMany()
            .HasForeignKey(l => l.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── ProductPriceHistory ───────────────────────────────
        modelBuilder.Entity<ProductPriceHistory>()
            .HasOne(h => h.Product)
            .WithMany()
            .HasForeignKey(h => h.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── CompanySettings (1:1) ─────────────────────────────
        modelBuilder.Entity<CompanySettings>()
            .HasOne(s => s.Company)
            .WithOne()
            .HasForeignKey<CompanySettings>(s => s.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CompanySettings>()
            .HasIndex(s => s.CompanyId)
            .IsUnique();

        // ── CompanyIntegrationWhatsapp (1:1) ──────────────────
        modelBuilder.Entity<CompanyIntegrationWhatsapp>()
            .HasOne(w => w.Company)
            .WithOne()
            .HasForeignKey<CompanyIntegrationWhatsapp>(w => w.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CompanyIntegrationWhatsapp>()
            .HasIndex(w => w.CompanyId)
            .IsUnique();

        // ── AdminUser ─────────────────────────────────────────
        modelBuilder.Entity<AdminUser>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<AdminUser>()
            .HasOne(u => u.Company)
            .WithMany()
            .HasForeignKey(u => u.CompanyId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        // ── MasterAuditLog ────────────────────────────────────
        // Sem FKs — TargetId é string flexível para qualquer tipo de alvo.
        modelBuilder.Entity<MasterAuditLog>()
            .HasIndex(l => l.CreatedAtUtc);
    }
}
