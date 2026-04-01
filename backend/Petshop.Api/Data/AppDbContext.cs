using Microsoft.EntityFrameworkCore;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Audit;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Dav;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Master;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Entities.Scale;
using Petshop.Api.Entities.Customers;
using Petshop.Api.Entities.Promotions;
using Petshop.Api.Entities.Financial;
using Petshop.Api.Entities.Purchases;
using Petshop.Api.Entities.Agenda;
using Petshop.Api.Entities.Enrichment;
using Petshop.Api.Entities.Stock;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Entities.WhatsApp;
using Petshop.Api.Entities.Marketplace;
using Petshop.Api.Entities.StoreFront;
using Petshop.Api.Entities.Commissions;
using Petshop.Api.Models;
using DeliveryRoute = Petshop.Api.Entities.Delivery.Route;
using Petshop.Api.Entities.Delivery;

namespace Petshop.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── Tenant ───────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<CompanyFeatureOverride> CompanyFeatureOverrides => Set<CompanyFeatureOverride>();

    // ── Catálogo ─────────────────────────────────────────────
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    // ── Clientes ─────────────────────────────────────────────
    public DbSet<Customer> Customers => Set<Customer>();

    // ── Pedidos ──────────────────────────────────────────────
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderPrintJob> PrintJobs => Set<OrderPrintJob>();

    // ── Entrega ──────────────────────────────────────────────
    public DbSet<Deliverer> Deliverers => Set<Deliverer>();
    public DbSet<DeliveryRoute> Routes => Set<DeliveryRoute>();
    public DbSet<RouteStop> RouteStops => Set<RouteStop>();

    // ── Enriquecimento de Catálogo ────────────────────────────────────────
    public DbSet<EnrichmentBatch>         EnrichmentBatches         => Set<EnrichmentBatch>();
    public DbSet<ProductEnrichmentResult> ProductEnrichmentResults  => Set<ProductEnrichmentResult>();
    public DbSet<ProductNameSuggestion>   ProductNameSuggestions    => Set<ProductNameSuggestion>();
    public DbSet<ProductImageCandidate>   ProductImageCandidates    => Set<ProductImageCandidate>();
    public DbSet<EnrichmentConfig>        EnrichmentConfigs         => Set<EnrichmentConfig>();

    // ── Loja Online (StoreFront) ──────────────────────────────────────────────
    public DbSet<StoreFrontConfig> StoreFrontConfigs => Set<StoreFrontConfig>();
    public DbSet<Table>            Tables            => Set<Table>();
    public DbSet<BannerSlide>      BannerSlides      => Set<BannerSlide>();

    // ── Sync ─────────────────────────────────────────────────
    public DbSet<ExternalSource> ExternalSources => Set<ExternalSource>();
    public DbSet<ExternalProductSnapshot> ExternalProductSnapshots => Set<ExternalProductSnapshot>();
    public DbSet<ProductSyncJob> ProductSyncJobs => Set<ProductSyncJob>();
    public DbSet<ProductSyncItem> ProductSyncItems => Set<ProductSyncItem>();

    // ── Auditoria ────────────────────────────────────────────
    public DbSet<ProductChangeLog> ProductChangeLogs => Set<ProductChangeLog>();
    public DbSet<ProductPriceHistory> ProductPriceHistories => Set<ProductPriceHistory>();

    // ── Insumos ───────────────────────────────────────────────
    public DbSet<Supply> Supplies => Set<Supply>();

    // ── Adicionais de Produto ─────────────────────────────────
    public DbSet<ProductAddon> ProductAddons => Set<ProductAddon>();

    // ── Adicionais de Item de Venda ───────────────────────────
    public DbSet<SaleOrderItemAddon> SaleOrderItemAddons => Set<SaleOrderItemAddon>();

    // ── Master Admin ──────────────────────────────────────────
    public DbSet<CompanySettings> CompanySettings => Set<CompanySettings>();
    public DbSet<CompanyIntegrationWhatsapp> CompanyIntegrationsWhatsapp => Set<CompanyIntegrationWhatsapp>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<MasterAuditLog> MasterAuditLogs => Set<MasterAuditLog>();
    public DbSet<AdminAlert> AdminAlerts => Set<AdminAlert>();
    public DbSet<PlatformWhatsappConfig> PlatformWhatsappConfigs => Set<PlatformWhatsappConfig>();

    // ── WhatsApp ──────────────────────────────────────────────
    public DbSet<WhatsAppContact> WhatsAppContacts => Set<WhatsAppContact>();
    public DbSet<WhatsAppMessageLog> WhatsAppMessageLogs => Set<WhatsAppMessageLog>();
    public DbSet<WhatsAppWebhookDedupe> WhatsAppWebhookDedupes => Set<WhatsAppWebhookDedupe>();

    // ── DAV / Orçamento ───────────────────────────────────────
    public DbSet<SalesQuote> SalesQuotes => Set<SalesQuote>();
    public DbSet<SalesQuoteItem> SalesQuoteItems => Set<SalesQuoteItem>();

    // ── Marketplace (iFood, etc.) ─────────────────────────────
    public DbSet<MarketplaceIntegration> MarketplaceIntegrations => Set<MarketplaceIntegration>();
    public DbSet<MarketplaceOrder>       MarketplaceOrders       => Set<MarketplaceOrder>();

    // ── PDV ───────────────────────────────────────────────────
    public DbSet<CashRegister>            CashRegisters            => Set<CashRegister>();
    public DbSet<CashRegisterFiscalConfig> CashRegisterFiscalConfigs => Set<CashRegisterFiscalConfig>();
    public DbSet<CashSession>             CashSessions             => Set<CashSession>();
    public DbSet<CashMovement>            CashMovements            => Set<CashMovement>();
    public DbSet<SaleOrder>               SaleOrders               => Set<SaleOrder>();
    public DbSet<SaleOrderItem>           SaleOrderItems           => Set<SaleOrderItem>();
    public DbSet<SalePayment>             SalePayments             => Set<SalePayment>();

    // ── Promoções (Fase 10) ───────────────────────────────────
    public DbSet<Promotion> Promotions => Set<Promotion>();

    // ── Fidelidade (Fase 9) ───────────────────────────────────
    public DbSet<LoyaltyConfig>       LoyaltyConfigs       => Set<LoyaltyConfig>();
    public DbSet<LoyaltyTransaction>  LoyaltyTransactions  => Set<LoyaltyTransaction>();

    // ── Financeiro (Fase 12) ──────────────────────────────────
    public DbSet<FinancialEntry> FinancialEntries => Set<FinancialEntry>();

    // ── Agenda de Serviços (Fase 13) ──────────────────────────
    public DbSet<ServiceType>        ServiceTypes        => Set<ServiceType>();
    public DbSet<ServiceAppointment> ServiceAppointments => Set<ServiceAppointment>();

    // ── Comissões e Gorjetas ──────────────────────────────────
    public DbSet<CommissionConfig> CommissionConfigs => Set<CommissionConfig>();
    public DbSet<EmployeeCommissionRate> EmployeeCommissionRates => Set<EmployeeCommissionRate>();
    public DbSet<TipPoolEntry> TipPoolEntries => Set<TipPoolEntry>();
    public DbSet<EmployeeCommissionAdjustment> EmployeeCommissionAdjustments => Set<EmployeeCommissionAdjustment>();

    // ── Compras & Fornecedores ────────────────────────────────
    public DbSet<Supplier>          Suppliers          => Set<Supplier>();
    public DbSet<PurchaseOrder>     PurchaseOrders     => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();

    // ── Estoque ───────────────────────────────────────────────
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // ── Scale Agents ──────────────────────────────────────────
    public DbSet<ScaleAgent>  ScaleAgents  => Set<ScaleAgent>();
    public DbSet<ScaleDevice> ScaleDevices => Set<ScaleDevice>();

    // ── Fiscal ────────────────────────────────────────────────
    public DbSet<FiscalConfig> FiscalConfigs => Set<FiscalConfig>();
    public DbSet<FiscalDocument> FiscalDocuments => Set<FiscalDocument>();
    public DbSet<FiscalQueue> FiscalQueues => Set<FiscalQueue>();
    public DbSet<FiscalAuditLog> FiscalAuditLogs => Set<FiscalAuditLog>();
    public DbSet<NfceNumberControl> NfceNumberControls => Set<NfceNumberControl>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Company ──────────────────────────────────────────
        modelBuilder.Entity<Company>()
            .HasIndex(c => c.Slug)
            .IsUnique();

        modelBuilder.Entity<CompanyFeatureOverride>()
            .HasOne(f => f.Company)
            .WithMany()
            .HasForeignKey(f => f.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CompanyFeatureOverride>()
            .HasIndex(f => new { f.CompanyId, f.FeatureKey })
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

        // RowVersion concurrency token foi removido de Product.cs ([Timestamp] retirado).
        // Sem optimistic concurrency no produto — atualizações de estoque são serializadas pela sessão.

        // ── ProductAddon ──────────────────────────────────────
        modelBuilder.Entity<ProductAddon>()
            .HasOne(a => a.Product)
            .WithMany(p => p.Addons)
            .HasForeignKey(a => a.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Supply ────────────────────────────────────────────
        modelBuilder.Entity<Supply>()
            .HasOne(s => s.Company)
            .WithMany()
            .HasForeignKey(s => s.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── SaleOrderItemAddon ────────────────────────────────
        modelBuilder.Entity<SaleOrderItemAddon>()
            .HasOne(a => a.SaleOrderItem)
            .WithMany(i => i.Addons)
            .HasForeignKey(a => a.SaleOrderItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── AdminAlert ────────────────────────────────────────
        modelBuilder.Entity<AdminAlert>()
            .HasIndex(a => new { a.CompanyId, a.IsRead });

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

        // ── Marketplace ───────────────────────────────────────
        modelBuilder.Entity<MarketplaceIntegration>()
            .HasOne(i => i.Company)
            .WithMany()
            .HasForeignKey(i => i.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MarketplaceIntegration>()
            .HasIndex(i => new { i.Type, i.MerchantId })
            .IsUnique();

        modelBuilder.Entity<MarketplaceOrder>()
            .HasOne<MarketplaceIntegration>()
            .WithMany(i => i.Orders)
            .HasForeignKey(o => o.MarketplaceIntegrationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MarketplaceOrder>()
            .HasOne<Order>()
            .WithMany()
            .HasForeignKey(o => o.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MarketplaceOrder>()
            .HasIndex(o => new { o.MarketplaceIntegrationId, o.ExternalOrderId })
            .IsUnique();

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

        // ── Customer ──────────────────────────────────────────
        modelBuilder.Entity<Customer>()
            .HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // Índice: busca por telefone dentro da empresa
        modelBuilder.Entity<Customer>()
            .HasIndex(c => new { c.CompanyId, c.Phone });

        // Customer → Orders (1:N, nullable no Order)
        modelBuilder.Entity<Customer>()
            .HasMany(c => c.Orders)
            .WithOne(o => o.Customer)
            .HasForeignKey(o => o.CustomerId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // ── OrderPrintJob ─────────────────────────────────────
        modelBuilder.Entity<OrderPrintJob>()
            .HasOne(j => j.Company)
            .WithMany()
            .HasForeignKey(j => j.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<OrderPrintJob>()
            .HasOne(j => j.Order)
            .WithMany()
            .HasForeignKey(j => j.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Busca rápida de jobs pendentes por empresa
        modelBuilder.Entity<OrderPrintJob>()
            .HasIndex(j => new { j.CompanyId, j.IsPrinted });

        // ── Order → Company (opcional, compatibilidade com pedidos antigos) ──
        modelBuilder.Entity<Order>()
            .HasOne(o => o.Company)
            .WithMany()
            .HasForeignKey(o => o.CompanyId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        // ── WhatsAppContact ───────────────────────────────────
        modelBuilder.Entity<WhatsAppContact>()
            .HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // Índice único: um wa_id por empresa
        modelBuilder.Entity<WhatsAppContact>()
            .HasIndex(c => new { c.CompanyId, c.WaId })
            .IsUnique();

        // ── WhatsAppMessageLog ────────────────────────────────
        modelBuilder.Entity<WhatsAppMessageLog>()
            .HasOne(m => m.Company)
            .WithMany()
            .HasForeignKey(m => m.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // Índice para busca de idempotência (orderId + triggerStatus)
        modelBuilder.Entity<WhatsAppMessageLog>()
            .HasIndex(m => new { m.OrderId, m.TriggerStatus });

        // Índice para busca por empresa + data
        modelBuilder.Entity<WhatsAppMessageLog>()
            .HasIndex(m => new { m.CompanyId, m.CreatedAtUtc });

        // ── WhatsAppWebhookDedupe ─────────────────────────────
        // Índice único por EventId para deduplificação rápida
        modelBuilder.Entity<WhatsAppWebhookDedupe>()
            .HasIndex(d => d.EventId)
            .IsUnique();

        modelBuilder.Entity<WhatsAppWebhookDedupe>()
            .HasIndex(d => d.CreatedAtUtc); // Para cleanup por TTL futuro

        // ══════════════════════════════════════════════════════
        // FISCAL
        // ══════════════════════════════════════════════════════

        // ── FiscalConfig (1:1 por empresa) ────────────────────
        modelBuilder.Entity<FiscalConfig>()
            .HasOne(f => f.Company)
            .WithOne()
            .HasForeignKey<FiscalConfig>(f => f.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FiscalConfig>()
            .HasIndex(f => f.CompanyId)
            .IsUnique();

        // Enums como string para legibilidade no banco e suporte a filtered index futuro
        modelBuilder.Entity<FiscalConfig>()
            .Property(f => f.TaxRegime)
            .HasConversion<string>()
            .HasMaxLength(30);

        modelBuilder.Entity<FiscalConfig>()
            .Property(f => f.SefazEnvironment)
            .HasConversion<string>()
            .HasMaxLength(20);

        // ── FiscalDocument ────────────────────────────────────
        modelBuilder.Entity<FiscalDocument>()
            .HasOne(d => d.Company)
            .WithMany()
            .HasForeignKey(d => d.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // Chave de acesso única (quando preenchida)
        modelBuilder.Entity<FiscalDocument>()
            .HasIndex(d => d.AccessKey)
            .IsUnique()
            .HasFilter("\"AccessKey\" IS NOT NULL");

        // Busca por empresa + status fiscal (job de contingência e relatórios)
        modelBuilder.Entity<FiscalDocument>()
            .HasIndex(d => new { d.CompanyId, d.FiscalStatus });

        modelBuilder.Entity<FiscalDocument>()
            .Property(d => d.DocumentType)
            .HasConversion<string>()
            .HasMaxLength(10);

        modelBuilder.Entity<FiscalDocument>()
            .Property(d => d.FiscalStatus)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<FiscalDocument>()
            .Property(d => d.ContingencyType)
            .HasConversion<string>()
            .HasMaxLength(20);

        // ── FiscalQueue ───────────────────────────────────────
        modelBuilder.Entity<FiscalQueue>()
            .HasOne(q => q.Company)
            .WithMany()
            .HasForeignKey(q => q.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // FK para FiscalDocument (nullable — preenchido após emissão)
        modelBuilder.Entity<FiscalQueue>()
            .HasOne(q => q.FiscalDocument)
            .WithMany()
            .HasForeignKey(q => q.FiscalDocumentId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Busca por empresa + status (job de processamento)
        modelBuilder.Entity<FiscalQueue>()
            .HasIndex(q => new { q.CompanyId, q.Status });

        modelBuilder.Entity<FiscalQueue>()
            .Property(q => q.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<FiscalQueue>()
            .Property(q => q.Priority)
            .HasConversion<string>()
            .HasMaxLength(20);

        // ── FiscalAuditLog ────────────────────────────────────
        // Sem FKs — log imutável, referências livres (como MasterAuditLog)
        modelBuilder.Entity<FiscalAuditLog>()
            .HasIndex(l => new { l.CompanyId, l.CreatedAtUtc });

        modelBuilder.Entity<FiscalAuditLog>()
            .HasIndex(l => new { l.EntityType, l.EntityId });

        // ── NfceNumberControl (PK composta) ───────────────────
        modelBuilder.Entity<NfceNumberControl>()
            .HasKey(n => new { n.CompanyId, n.Serie });

        // ══════════════════════════════════════════════════════
        // SCALE AGENTS (Fase 4)
        // ══════════════════════════════════════════════════════

        // ── ScaleAgent ────────────────────────────────────────
        modelBuilder.Entity<ScaleAgent>()
            .HasOne(a => a.Company)
            .WithMany()
            .HasForeignKey(a => a.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ScaleAgent>()
            .HasIndex(a => new { a.CompanyId, a.MachineName });

        modelBuilder.Entity<ScaleAgent>()
            .HasIndex(a => a.AgentKey)
            .IsUnique();

        // ── ScaleDevice ───────────────────────────────────────
        modelBuilder.Entity<ScaleDevice>()
            .HasOne(d => d.Agent)
            .WithMany(a => a.Devices)
            .HasForeignKey(d => d.AgentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ScaleDevice>()
            .Property(d => d.ScaleModel)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<ScaleDevice>()
            .HasIndex(d => new { d.AgentId, d.IsActive });

        // ══════════════════════════════════════════════════════
        // BALANÇA — Product (campos adicionados na Fase 1)
        // ══════════════════════════════════════════════════════

        // Enum ScaleBarcodeMode como string para legibilidade e futuros filtered indexes
        modelBuilder.Entity<Product>()
            .Property(p => p.ScaleBarcodeMode)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Índice para lookup por código de balança dentro da empresa
        modelBuilder.Entity<Product>()
            .HasIndex(p => new { p.CompanyId, p.ScaleProductCode })
            .HasFilter("\"ScaleProductCode\" IS NOT NULL");

        // ══════════════════════════════════════════════════════
        // PROMOÇÕES (Fase 10)
        // ══════════════════════════════════════════════════════

        modelBuilder.Entity<Promotion>()
            .HasOne(p => p.Company)
            .WithMany()
            .HasForeignKey(p => p.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Promotion>()
            .Property(p => p.Type)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<Promotion>()
            .Property(p => p.Scope)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<Promotion>()
            .HasIndex(p => new { p.CompanyId, p.IsActive, p.ExpiresAtUtc });

        modelBuilder.Entity<Promotion>()
            .HasIndex(p => new { p.CompanyId, p.CouponCode })
            .HasFilter("\"CouponCode\" IS NOT NULL");

        // ══════════════════════════════════════════════════════
        // CLIENTES & FIDELIDADE (Fase 9)
        // ══════════════════════════════════════════════════════

        // ── Customer (loyalty indexes — entidade base já configurada acima) ──
        modelBuilder.Entity<Petshop.Api.Entities.Customer>()
            .HasIndex(c => new { c.CompanyId, c.Cpf });

        modelBuilder.Entity<Petshop.Api.Entities.Customer>()
            .HasIndex(c => new { c.CompanyId, c.PointsBalance });

        // ── LoyaltyConfig ─────────────────────────────────────
        modelBuilder.Entity<LoyaltyConfig>()
            .HasIndex(c => c.CompanyId)
            .IsUnique();

        // ── LoyaltyTransaction ────────────────────────────────
        modelBuilder.Entity<LoyaltyTransaction>()
            .HasOne(t => t.Customer)
            .WithMany(c => c.LoyaltyTransactions)
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LoyaltyTransaction>()
            .HasIndex(t => new { t.CompanyId, t.CustomerId, t.CreatedAtUtc });

        // ══════════════════════════════════════════════════════
        // COMPRAS & FORNECEDORES (Fase 8)
        // ══════════════════════════════════════════════════════

        // ── Supplier ──────────────────────────────────────────
        modelBuilder.Entity<Supplier>()
            .HasOne(s => s.Company)
            .WithMany()
            .HasForeignKey(s => s.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Supplier>()
            .HasIndex(s => new { s.CompanyId, s.Name });

        // ── PurchaseOrder ─────────────────────────────────────
        modelBuilder.Entity<PurchaseOrder>()
            .HasOne(p => p.Supplier)
            .WithMany(s => s.PurchaseOrders)
            .HasForeignKey(p => p.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PurchaseOrder>()
            .Property(p => p.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(p => new { p.CompanyId, p.Status, p.CreatedAtUtc });

        // ── PurchaseOrderItem ─────────────────────────────────
        modelBuilder.Entity<PurchaseOrderItem>()
            .HasOne(i => i.PurchaseOrder)
            .WithMany(p => p.Items)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // ══════════════════════════════════════════════════════
        // ESTOQUE (Fase 6)
        // ══════════════════════════════════════════════════════

        // ── StockMovement ─────────────────────────────────────
        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.Product)
            .WithMany()
            .HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockMovement>()
            .Property(m => m.MovementType)
            .HasConversion<string>()
            .HasMaxLength(30);

        // Consulta padrão: movimentos por produto ordenados por data
        modelBuilder.Entity<StockMovement>()
            .HasIndex(m => new { m.CompanyId, m.ProductId, m.CreatedAtUtc });

        // Consulta por venda (para rastreabilidade)
        modelBuilder.Entity<StockMovement>()
            .HasIndex(m => m.SaleOrderId)
            .HasFilter("\"SaleOrderId\" IS NOT NULL");

        // ══════════════════════════════════════════════════════
        // DAV / ORÇAMENTO (Fase 2)
        // ══════════════════════════════════════════════════════

        // ── SalesQuote ────────────────────────────────────────
        modelBuilder.Entity<SalesQuote>()
            .HasOne(q => q.Company)
            .WithMany()
            .HasForeignKey(q => q.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        // Enums como string
        modelBuilder.Entity<SalesQuote>()
            .Property(q => q.Status)
            .HasConversion<string>()
            .HasMaxLength(30);

        modelBuilder.Entity<SalesQuote>()
            .Property(q => q.Origin)
            .HasConversion<string>()
            .HasMaxLength(20);

        // PublicId único globalmente (como Order.PublicId)
        modelBuilder.Entity<SalesQuote>()
            .HasIndex(q => q.PublicId)
            .IsUnique();

        // Busca por empresa + status (fila de aprovação fiscal e listagens)
        modelBuilder.Entity<SalesQuote>()
            .HasIndex(q => new { q.CompanyId, q.Status });

        // Busca por empresa + data
        modelBuilder.Entity<SalesQuote>()
            .HasIndex(q => new { q.CompanyId, q.CreatedAtUtc });

        // Garantia: um pedido de delivery gera no máximo um DAV
        modelBuilder.Entity<SalesQuote>()
            .HasIndex(q => q.OriginOrderId)
            .IsUnique()
            .HasFilter("\"OriginOrderId\" IS NOT NULL");

        // ── SalesQuoteItem ────────────────────────────────────
        modelBuilder.Entity<SalesQuoteItem>()
            .HasOne(i => i.SalesQuote)
            .WithMany(q => q.Items)
            .HasForeignKey(i => i.SalesQuoteId)
            .OnDelete(DeleteBehavior.Cascade);

        // ══════════════════════════════════════════════════════
        // MARKETPLACE (iFood, etc.)
        // ══════════════════════════════════════════════════════

        // ══════════════════════════════════════════════════════
        // PDV (Fase 3)
        // ══════════════════════════════════════════════════════

        // ── CashRegister ──────────────────────────────────────
        modelBuilder.Entity<CashRegister>()
            .HasOne(r => r.Company)
            .WithMany()
            .HasForeignKey(r => r.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CashRegister>()
            .HasIndex(r => new { r.CompanyId, r.IsActive });

        // ── CashRegisterFiscalConfig (1:1 por terminal) ───────
        modelBuilder.Entity<CashRegisterFiscalConfig>()
            .HasOne(f => f.CashRegister)
            .WithOne()
            .HasForeignKey<CashRegisterFiscalConfig>(f => f.CashRegisterId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CashRegisterFiscalConfig>()
            .HasIndex(f => f.CashRegisterId)
            .IsUnique();

        modelBuilder.Entity<CashRegisterFiscalConfig>()
            .Property(f => f.TaxRegime)
            .HasConversion<string>()
            .HasMaxLength(30);

        modelBuilder.Entity<CashRegisterFiscalConfig>()
            .Property(f => f.SefazEnvironment)
            .HasConversion<string>()
            .HasMaxLength(20);

        // ── CashSession ───────────────────────────────────────
        modelBuilder.Entity<CashSession>()
            .HasOne(s => s.CashRegister)
            .WithMany(r => r.Sessions)
            .HasForeignKey(s => s.CashRegisterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CashSession>()
            .Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(10);

        // Um terminal só pode ter uma sessão aberta por vez
        modelBuilder.Entity<CashSession>()
            .HasIndex(s => new { s.CashRegisterId, s.Status })
            .HasFilter("\"Status\" = 'Open'")
            .IsUnique();

        modelBuilder.Entity<CashSession>()
            .HasIndex(s => new { s.CompanyId, s.OpenedAtUtc });

        // ── SaleOrder ─────────────────────────────────────────
        modelBuilder.Entity<SaleOrder>()
            .HasOne(o => o.CashSession)
            .WithMany(s => s.Sales)
            .HasForeignKey(o => o.CashSessionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SaleOrder>()
            .Property(o => o.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<SaleOrder>()
            .HasIndex(o => o.PublicId)
            .IsUnique();

        modelBuilder.Entity<SaleOrder>()
            .HasIndex(o => new { o.CompanyId, o.CreatedAtUtc });

        modelBuilder.Entity<SaleOrder>()
            .HasIndex(o => new { o.CashSessionId, o.Status });

        // ── SaleOrderItem ─────────────────────────────────────
        modelBuilder.Entity<SaleOrderItem>()
            .HasOne(i => i.SaleOrder)
            .WithMany(o => o.Items)
            .HasForeignKey(i => i.SaleOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── SalePayment ───────────────────────────────────────
        modelBuilder.Entity<SalePayment>()
            .HasOne(p => p.SaleOrder)
            .WithMany(o => o.Payments)
            .HasForeignKey(p => p.SaleOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── CashMovement ──────────────────────────────────────
        modelBuilder.Entity<CashMovement>()
            .HasOne(m => m.CashSession)
            .WithMany(s => s.Movements)
            .HasForeignKey(m => m.CashSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CashMovement>()
            .Property(m => m.Type)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<CashMovement>()
            .HasIndex(m => new { m.CompanyId, m.CashSessionId });

        // ── FinancialEntry ────────────────────────────────────
        modelBuilder.Entity<FinancialEntry>()
            .HasOne(e => e.Company)
            .WithMany()
            .HasForeignKey(e => e.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialEntry>()
            .Property(e => e.Type)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<FinancialEntry>()
            .HasIndex(e => new { e.CompanyId, e.DueDate });

        modelBuilder.Entity<FinancialEntry>()
            .HasIndex(e => new { e.CompanyId, e.IsPaid, e.DueDate });

        // ══════════════════════════════════════════════════════
        // AGENDA DE SERVIÇOS (Fase 13)
        // ══════════════════════════════════════════════════════

        // ── ServiceType ───────────────────────────────────────
        modelBuilder.Entity<ServiceType>()
            .HasOne(t => t.Company)
            .WithMany()
            .HasForeignKey(t => t.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ServiceType>()
            .HasIndex(t => new { t.CompanyId, t.IsActive });

        // ── ServiceAppointment ────────────────────────────────
        modelBuilder.Entity<ServiceAppointment>()
            .HasOne(a => a.Company)
            .WithMany()
            .HasForeignKey(a => a.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ServiceAppointment>()
            .HasOne(a => a.ServiceType)
            .WithMany()
            .HasForeignKey(a => a.ServiceTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ServiceAppointment>()
            .Property(a => a.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Busca por empresa + data (view de agenda diária/semanal)
        modelBuilder.Entity<ServiceAppointment>()
            .HasIndex(a => new { a.CompanyId, a.ScheduledAt });

        // Busca por empresa + status (painel de atendimento)
        modelBuilder.Entity<ServiceAppointment>()
            .HasIndex(a => new { a.CompanyId, a.Status });

        // ═════════════════════════════════════════════════════════════════════
        // COMISSÕES & GORJETAS
        // ═════════════════════════════════════════════════════════════════════

        modelBuilder.Entity<CommissionConfig>()
            .HasOne(c => c.Company)
            .WithOne()
            .HasForeignKey<CommissionConfig>(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CommissionConfig>()
            .HasIndex(c => c.CompanyId)
            .IsUnique();

        modelBuilder.Entity<CommissionConfig>()
            .Property(c => c.TipDistributionMode)
            .HasMaxLength(40);

        modelBuilder.Entity<EmployeeCommissionRate>()
            .HasOne(r => r.Company)
            .WithMany()
            .HasForeignKey(r => r.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EmployeeCommissionRate>()
            .HasOne(r => r.AdminUser)
            .WithMany()
            .HasForeignKey(r => r.AdminUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmployeeCommissionRate>()
            .HasIndex(r => new { r.CompanyId, r.AdminUserId })
            .IsUnique();

        modelBuilder.Entity<TipPoolEntry>()
            .HasOne(t => t.Company)
            .WithMany()
            .HasForeignKey(t => t.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TipPoolEntry>()
            .HasIndex(t => new { t.CompanyId, t.ReferenceDateUtc });

        modelBuilder.Entity<EmployeeCommissionAdjustment>()
            .HasOne(a => a.Company)
            .WithMany()
            .HasForeignKey(a => a.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EmployeeCommissionAdjustment>()
            .HasOne(a => a.AdminUser)
            .WithMany()
            .HasForeignKey(a => a.AdminUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmployeeCommissionAdjustment>()
            .HasIndex(a => new { a.CompanyId, a.ReferenceDateUtc, a.AdminUserId });

        // ══════════════════════════════════════════════════════
        // ENRIQUECIMENTO DE CATÁLOGO
        // ══════════════════════════════════════════════════════

        // ── EnrichmentBatch ───────────────────────────────────
        modelBuilder.Entity<EnrichmentBatch>()
            .HasOne(b => b.Company)
            .WithMany()
            .HasForeignKey(b => b.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EnrichmentBatch>()
            .HasOne(b => b.SyncJob)
            .WithMany()
            .HasForeignKey(b => b.SyncJobId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<EnrichmentBatch>()
            .Property(b => b.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        modelBuilder.Entity<EnrichmentBatch>()
            .Property(b => b.Trigger)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Busca rápida de lotes por empresa + status (dashboard)
        modelBuilder.Entity<EnrichmentBatch>()
            .HasIndex(b => new { b.CompanyId, b.Status });

        modelBuilder.Entity<EnrichmentBatch>()
            .HasIndex(b => new { b.CompanyId, b.CreatedAtUtc });

        // ── ProductEnrichmentResult ───────────────────────────
        modelBuilder.Entity<ProductEnrichmentResult>()
            .HasOne(r => r.Batch)
            .WithMany(b => b.Results)
            .HasForeignKey(r => r.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductEnrichmentResult>()
            .HasOne(r => r.Product)
            .WithMany()
            .HasForeignKey(r => r.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductEnrichmentResult>()
            .Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Busca de itens pendentes por batch
        modelBuilder.Entity<ProductEnrichmentResult>()
            .HasIndex(r => new { r.BatchId, r.Status });

        // Busca de resultado de produto específico
        modelBuilder.Entity<ProductEnrichmentResult>()
            .HasIndex(r => new { r.CompanyId, r.ProductId });

        // ── ProductNameSuggestion ─────────────────────────────
        modelBuilder.Entity<ProductNameSuggestion>()
            .HasOne(s => s.Product)
            .WithMany()
            .HasForeignKey(s => s.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductNameSuggestion>()
            .HasOne(s => s.Batch)
            .WithMany()
            .HasForeignKey(s => s.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductNameSuggestion>()
            .Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(30);

        modelBuilder.Entity<ProductNameSuggestion>()
            .Property(s => s.Source)
            .HasConversion<string>()
            .HasMaxLength(30);

        // Fila de revisão: empresa + status
        modelBuilder.Entity<ProductNameSuggestion>()
            .HasIndex(s => new { s.CompanyId, s.Status });

        // ── ProductImageCandidate ─────────────────────────────
        modelBuilder.Entity<ProductImageCandidate>()
            .HasOne(c => c.Product)
            .WithMany()
            .HasForeignKey(c => c.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductImageCandidate>()
            .HasOne(c => c.Batch)
            .WithMany()
            .HasForeignKey(c => c.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductImageCandidate>()
            .Property(c => c.Status)
            .HasConversion<string>()
            .HasMaxLength(30);

        // Fila de revisão: empresa + status
        modelBuilder.Entity<ProductImageCandidate>()
            .HasIndex(c => new { c.CompanyId, c.Status });

        // ── EnrichmentConfig (1:1 por empresa) ────────────────
        modelBuilder.Entity<EnrichmentConfig>()
            .HasOne(e => e.Company)
            .WithOne()
            .HasForeignKey<EnrichmentConfig>(e => e.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EnrichmentConfig>()
            .HasIndex(e => e.CompanyId)
            .IsUnique();

        // ── Table (Mesas) ─────────────────────────────────────────────────────
        modelBuilder.Entity<Table>()
            .HasIndex(t => new { t.CompanyId, t.Number })
            .IsUnique();

        // ── Order.TableId ─────────────────────────────────────────────────────
        modelBuilder.Entity<Order>()
            .HasIndex(o => o.TableId)
            .HasFilter("\"TableId\" IS NOT NULL");
    }
}
