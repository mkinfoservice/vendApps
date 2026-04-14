using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Petshop.Api.Services;
using Microsoft.OpenApi.Models;
using Petshop.Api.Services.Geocoding;
using Petshop.Api.Services.Images;
using Petshop.Api.Services.Sync;
using System.Text.Json.Serialization;
using Petshop.Api.Hubs;
using Petshop.Api.Services.Print;
using Petshop.Api.Services.Dav.Jobs;
using Petshop.Api.Services.Enrichment;
using Petshop.Api.Services.Enrichment.Jobs;
using Petshop.Api.Services.Fiscal;
using Petshop.Api.Services.Fiscal.Jobs;
using Petshop.Api.Services.Scale;
using Petshop.Api.Services.Scale.Jobs;
using Petshop.Api.Services.Tenancy;
using Petshop.Api.Services.Accounting;
using Petshop.Api.Services.Accounting.Jobs;
using Microsoft.AspNetCore.DataProtection;

// QuestPDF Community license — deve ser configurado antes de qualquer uso
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// ===============================
// Porta dinâmica (Render define PORT)
// ===============================
var port = Environment.GetEnvironmentVariable("PORT") ?? "5082";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// ===============================
// Controllers
// ===============================
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// ===============================
// SignalR
// ===============================
builder.Services.AddSignalR(o =>
{
    // Render LB tem timeout de ~55s em conexões idle.
    // Servidor pinga o cliente a cada 10s (< 55s) para manter o WebSocket vivo.
    o.KeepAliveInterval      = TimeSpan.FromSeconds(10);
    // Se o cliente não responder em 30s, desconecta (withReconnect tratará isso no cliente)
    o.ClientTimeoutInterval  = TimeSpan.FromSeconds(30);
});

// ===============================
// Swagger + JWT Authorization
// ===============================
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "vendApps API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Insira o token JWT no formato: Bearer {seu_token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ===============================
// JWT Authentication
// ===============================
var jwt = builder.Configuration.GetSection("Jwt");
var key = Encoding.UTF8.GetBytes(jwt["Key"]!);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name
        };

        // SignalR envia o token via query string para WebSockets
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ===============================
// EF Core + PostgreSQL
// ===============================
var cs = builder.Configuration.GetConnectionString("Default");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(cs);
});

// ===============================
// Hangfire
// ===============================
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(options => options.UseNpgsqlConnection(cs)));

builder.Services.AddHangfireServer();

// ===============================
// Services — Delivery
// ===============================
builder.Services.AddScoped<DeliveryManagementService>();
builder.Services.AddScoped<RouteOptimizationService>();
builder.Services.AddScoped<RouteStopTransitionService>();

builder.Services.AddScoped<Petshop.Api.Services.Routes.DepotService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.GeofencingService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.NeighborhoodClassificationService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.RouteSideValidator>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.RoutePreviewService>();

// ===============================
// Services — Geocoding
// ===============================
builder.Services.AddHttpClient<OrsMatrixService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddHttpClient<ViaCepService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});

builder.Services.AddHttpClient<OrsGeocodingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddHttpClient<NominatimGeocodingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddScoped<IGeocodingService, FallbackGeocodingService>();

// ===============================
// Services — Produto / Sync
// ===============================
builder.Services.AddHttpClient(); // IHttpClientFactory para conectores REST
builder.Services.AddScoped<ConnectorFactory>();
builder.Services.AddScoped<ProductHashService>();
builder.Services.AddScoped<SyncMergePolicyService>();
builder.Services.AddScoped<ProductSyncService>();
builder.Services.AddScoped<SyncSchedulerJob>();
builder.Services.AddScoped<DbSchemaDiscoveryService>();

// ===============================
// Services — Imagens
// ===============================
builder.Services.AddScoped<IImageStorageProvider, LocalImageStorageProvider>();

// ===============================
// Services — Enriquecimento de Catálogo
// ===============================
builder.Services.AddScoped<ProductNormalizationService>();
builder.Services.AddScoped<EnrichmentScoringService>();
builder.Services.AddScoped<ProductImageMatchingService>();
builder.Services.AddScoped<EnrichmentBatchService>();
builder.Services.AddScoped<CatalogEnrichmentOrchestrator>();
builder.Services.AddScoped<EnrichNormalizeProductsJob>();
builder.Services.AddScoped<EnrichMatchImagesJob>();

// Cosmos (Bluesoft) — busca de imagem por EAN/GTIN, base brasileira
// Requer COSMOS_TOKEN nas variáveis de ambiente (cadastro gratuito em cosmos.bluesoft.com.br)
builder.Services.AddHttpClient<CosmosImageMatcher>(client =>
{
    var token = builder.Configuration["COSMOS_TOKEN"];
    if (!string.IsNullOrWhiteSpace(token))
        client.DefaultRequestHeaders.Add("X-Cosmos-Token", token.Trim());
    client.Timeout = TimeSpan.FromSeconds(8);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("vendApps-enrichment/1.0");
});
builder.Services.AddScoped<CosmosImageMatcher>();
builder.Services.AddScoped<IProductImageMatcher, CosmosImageMatcher>();

// ===============================
// Services — Master Admin
// ===============================
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<AppDbContext>()
    .SetApplicationName("vendApps");
builder.Services.AddScoped<Petshop.Api.Services.Master.MasterAuditService>();
builder.Services.AddScoped<Petshop.Api.Services.Master.MasterCryptoService>();

// ===============================
// Services — Tenant
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.TenantResolverService>();
builder.Services.AddScoped<PlanFeatureService>();

// ===============================
// Services — Impressão
// ===============================
builder.Services.AddScoped<PrintService>();

// ===============================
// Services — Balança
// ===============================
builder.Services.AddScoped<ScaleBarcodeParser>();
builder.Services.AddScoped<ScaleProductSyncJob>();

// ===============================
// Services — Estoque (Fase 6)
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.Stock.StockService>();

// ===============================
// Services — Compras (Fase 8)
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.Purchases.PurchaseReceivingService>();

// ===============================
// Services — Clientes (Fase 9)
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.Customers.LoyaltyService>();
builder.Services.AddScoped<Petshop.Api.Services.Customers.CpfProtectionService>();

// ===============================
// Services — Fechamento Contabil
// ===============================
builder.Services.Configure<AccountingMailSettings>(builder.Configuration.GetSection("AccountingDispatch:Smtp"));
builder.Services.AddScoped<AccountingDataCollectorService>();
builder.Services.AddScoped<AccountingExportService>();
builder.Services.AddScoped<AccountingEmailService>();
builder.Services.AddScoped<AccountingDispatchService>();
builder.Services.AddScoped<AccountingDispatchSchedulerJob>();

// ===============================
// Services — Promoções (Fase 10)
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.Promotions.PromotionEngine>();

// ===============================
// Services — Fiscal (Fase 5)
// ===============================
builder.Services.AddScoped<NfceSigningService>();
builder.Services.AddHttpClient<SefazHttpClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<RealFiscalEngine>();

// ===============================
// Services — DAV / Orçamento
// ===============================
builder.Services.AddScoped<DeliveryOrderToDavJob>();

// ===============================
// Services — Fiscal
// ===============================
builder.Services.AddScoped<IFiscalEngine, MockFiscalEngine>();
builder.Services.AddScoped<FiscalDecisionService>();
builder.Services.AddScoped<NfceNumberService>();
builder.Services.AddScoped<FiscalQueueProcessorJob>();
builder.Services.AddScoped<FiscalCertProtectionService>();
builder.Services.AddScoped<ContingencyReprocessJob>();
builder.Services.AddScoped<DavAbandonmentJob>();

// ===============================
// Services — Marketplace (iFood, ...)
// ===============================
builder.Services.AddHttpClient("ifood", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("vendApps-marketplace/1.0");
});
builder.Services.AddSingleton<Petshop.Api.Services.Marketplace.IFood.iFoodAuthService>();
builder.Services.AddScoped<Petshop.Api.Services.Marketplace.IFood.iFoodOrderIngester>();
builder.Services.AddScoped<Petshop.Api.Services.Marketplace.IFood.iFoodStatusCallbackService>();
builder.Services.AddScoped<Petshop.Api.Services.Marketplace.IFood.iFoodCatalogSyncService>();
builder.Services.AddScoped<Petshop.Api.Services.Marketplace.IMarketplaceOrderIngester>(
    sp => sp.GetRequiredService<Petshop.Api.Services.Marketplace.IFood.iFoodOrderIngester>());
builder.Services.AddScoped<Petshop.Api.Services.Marketplace.IMarketplaceStatusCallback>(
    sp => sp.GetRequiredService<Petshop.Api.Services.Marketplace.IFood.iFoodStatusCallbackService>());

// ===============================
// Services — WhatsApp
// ===============================
builder.Services.AddHttpClient<Petshop.Api.Services.WhatsApp.WhatsAppClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<Petshop.Api.Services.WhatsApp.WhatsAppWebhookProcessor>();
builder.Services.AddScoped<Petshop.Api.Services.WhatsApp.WhatsAppNotificationService>();
builder.Services.AddScoped<Petshop.Api.Services.WhatsApp.WhatsAppInboundRouter>();
builder.Services.AddSingleton<Petshop.Api.Services.Pdv.SaleReceiptPdfService>();

// ===============================
// CORS
// ===============================
builder.Services.AddCors(options =>
{
    var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    // Lê TENANT_BASE_DOMAIN do config (mesmo valor que TenantResolverService usa)
    var tenantBaseDomain = (builder.Configuration["TENANT_BASE_DOMAIN"] ?? "vendapps.com.br")
        .ToLowerInvariant().Trim('.');

    bool IsTenantOrigin(string origin)
    {
        try
        {
            var host = new Uri(origin).Host.ToLowerInvariant();
            // Aceita o domínio apex (ex: vendapps.com.br) e qualquer subdomínio direto
            return string.Equals(host, tenantBaseDomain, StringComparison.OrdinalIgnoreCase)
                || host.EndsWith("." + tenantBaseDomain, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    options.AddPolicy("Frontend", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
                origin.StartsWith("http://localhost") ||
                origin.StartsWith("http://127.0.0.1") ||
                allowedOrigins.Any(o => origin.Equals(o, StringComparison.OrdinalIgnoreCase)) ||
                IsTenantOrigin(origin))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Necessário para SignalR WebSockets
    });
});

// ===============================
// Rate Limiting
// ===============================
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Autenticação — 5 tentativas por minuto por IP
    options.AddPolicy("auth_login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Endpoints públicos — 20 requisições por minuto por IP
    options.AddPolicy("public_api", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

// ===============================
// Global Exception Handler
// ===============================
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";

        var exceptionFeature = context.Features.Get<IExceptionHandlerFeature>();
        if (exceptionFeature != null)
        {
            var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError(exceptionFeature.Error,
                "UNHANDLED EXCEPTION | {Method} {Path} | {Message}",
                context.Request.Method,
                context.Request.Path,
                exceptionFeature.Error.Message);
        }

        object response = app.Environment.IsDevelopment() && exceptionFeature != null
            ? new { error = exceptionFeature.Error.Message, detail = exceptionFeature.Error.ToString() }
            : (object)new { error = "Erro interno do servidor." };
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    });
});

// ===============================
// Dev-only Middleware
// ===============================
var enableSwagger = app.Environment.IsDevelopment()
    || string.Equals(builder.Configuration["ENABLE_SWAGGER"], "true", StringComparison.OrdinalIgnoreCase);

// Aplica migrations pendentes automaticamente (seguro para Render/NeonDB)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Backfill: registra no __EFMigrationsHistory migrations que foram aplicadas via
    // raw SQL fallback no Program.cs e nunca tiveram [Migration] attribute registrado.
    // Sem isso o EF tenta reaplicá-las e falha com "already exists".
    await db.Database.ExecuteSqlRawAsync("""
        DO $$
        BEGIN
          IF EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = '__EFMigrationsHistory'
          )
          AND EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = 'CashRegisterFiscalConfigs'
          )
          THEN
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT t.mid, '8.0.0'
            FROM (VALUES
                ('20260314200001_AddFiscalCertBase64Column'),
                ('20260314210000_AddCashRegisterFiscalConfig')
            ) AS t(mid)
            WHERE NOT EXISTS (
                SELECT 1 FROM "__EFMigrationsHistory" h
                WHERE h."MigrationId" = t.mid
            );
          END IF;
        END $$;
        """);

    await db.Database.MigrateAsync();

    // ── Safety nets idempotentes (ADD COLUMN IF NOT EXISTS) ──────────────────
    // Garante que colunas adicionadas em migrations recentes existam no banco,
    // mesmo que a migration tenha sido marcada no __EFMigrationsHistory sem
    // executar o DDL (bug conhecido em deploys com lock de schema no Render).

    // [20260414] OrderId em LoyaltyTransactions — vincula transação ao pedido de delivery
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "LoyaltyTransactions"
            ADD COLUMN IF NOT EXISTS "OrderId" uuid;
        CREATE INDEX IF NOT EXISTS "IX_LoyaltyTransactions_OrderId"
            ON "LoyaltyTransactions" ("OrderId");
        """);

    // [20260414] AddonGroups — fluxo step-by-step de adicionais por grupo
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "ProductAddonGroups" (
            "Id"             uuid                         NOT NULL,
            "ProductId"      uuid                         NOT NULL,
            "Name"           character varying(80)        NOT NULL,
            "IsRequired"     boolean                      NOT NULL DEFAULT false,
            "SelectionType"  character varying(10)        NOT NULL DEFAULT 'multiple',
            "MinSelections"  integer                      NOT NULL DEFAULT 0,
            "MaxSelections"  integer                      NOT NULL DEFAULT 0,
            "SortOrder"      integer                      NOT NULL DEFAULT 0,
            CONSTRAINT "PK_ProductAddonGroups" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_ProductAddonGroups_Products_ProductId"
                FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_ProductAddonGroups_ProductId"
            ON "ProductAddonGroups" ("ProductId");
        ALTER TABLE "ProductAddons"
            ADD COLUMN IF NOT EXISTS "AddonGroupId" uuid;
        CREATE INDEX IF NOT EXISTS "IX_ProductAddons_AddonGroupId"
            ON "ProductAddons" ("AddonGroupId");
        """);

    // Garante colunas de AddOperationalQuerySupport (migration pode ter sido marcada
    // como aplicada no __EFMigrationsHistory sem ter executado o DDL — aplica aqui de
    // forma idempotente para garantir que as colunas existam em qualquer cenário)
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "SaleOrders"
            ADD COLUMN IF NOT EXISTS "CashRegisterNameSnapshot" character varying(80),
            ADD COLUMN IF NOT EXISTS "OperatorUserId"           uuid,
            ADD COLUMN IF NOT EXISTS "OperatorName"             character varying(100);
        """);

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Orders"
            ADD COLUMN IF NOT EXISTS "OriginChannel"     character varying(30),
            ADD COLUMN IF NOT EXISTS "OriginSaleOrderId" uuid;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "SalesQuotes"
            ADD COLUMN IF NOT EXISTS "IsArchived"    boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "ArchivedAtUtc" timestamp with time zone,
            ADD COLUMN IF NOT EXISTS "ExpiresAtUtc"  timestamp with time zone;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE INDEX IF NOT EXISTS "IX_Orders_CompanyId_OriginChannel"
            ON "Orders" ("CompanyId", "OriginChannel");
        CREATE INDEX IF NOT EXISTS "IX_FiscalDocuments_CompanyId_SaleOrderId"
            ON "FiscalDocuments" ("CompanyId", "SaleOrderId");
        CREATE INDEX IF NOT EXISTS "IX_SalesQuotes_CompanyId_IsArchived_Status"
            ON "SalesQuotes" ("CompanyId", "IsArchived", "Status");
        """);

    // Garante colunas que podem ter ficado fora das migrations (idempotente)
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "FiscalConfigs"
        ADD COLUMN IF NOT EXISTS "CertificateBase64" text;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Categories"
        ADD COLUMN IF NOT EXISTS "SortOrder" integer NOT NULL DEFAULT 0;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Orders"
        ADD COLUMN IF NOT EXISTS "DiscountCents" integer NOT NULL DEFAULT 0;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Promotions"
        ADD COLUMN IF NOT EXISTS "LoyaltyPointsCost" integer;
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "AccountingDispatchConfigs" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "IsEnabled" boolean NOT NULL DEFAULT false,
            "AccountantName" character varying(160),
            "PrimaryEmail" character varying(200),
            "CcEmails" character varying(1000),
            "Frequency" character varying(20) NOT NULL DEFAULT 'Monthly',
            "DayOfMonth" integer NOT NULL DEFAULT 5,
            "DayOfWeek" integer NOT NULL DEFAULT 1,
            "SendTimeLocal" character varying(5) NOT NULL DEFAULT '09:00',
            "TimezoneId" character varying(80) NOT NULL DEFAULT 'America/Sao_Paulo',
            "IncludeXmlIssued" boolean NOT NULL DEFAULT true,
            "IncludeXmlCanceled" boolean NOT NULL DEFAULT false,
            "IncludeSalesCsv" boolean NOT NULL DEFAULT true,
            "IncludeSummaryPdf" boolean NOT NULL DEFAULT true,
            "MaxRetryCount" integer NOT NULL DEFAULT 2,
            "RetryDelayMinutes" integer NOT NULL DEFAULT 15,
            "FixedEmailNote" character varying(1000),
            "ProtectAttachments" boolean NOT NULL DEFAULT false,
            "AttachmentPassword" character varying(300),
            "MaxAttachmentSizeMb" integer NOT NULL DEFAULT 15,
            "SendWhenNoMovement" character varying(20) NOT NULL DEFAULT 'Skip',
            "LastSentAtUtc" timestamp with time zone,
            "LastSuccessAtUtc" timestamp with time zone,
            "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
            "UpdatedBy" character varying(120),
            CONSTRAINT "PK_AccountingDispatchConfigs" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AccountingDispatchConfigs_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_AccountingDispatchConfigs_CompanyId"
            ON "AccountingDispatchConfigs" ("CompanyId");
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "AccountingDispatchRuns" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "PeriodStartUtc" timestamp with time zone NOT NULL,
            "PeriodEndUtc" timestamp with time zone NOT NULL,
            "PeriodReference" character varying(20) NOT NULL,
            "TriggerType" character varying(20) NOT NULL,
            "Status" character varying(20) NOT NULL,
            "CorrelationId" character varying(80) NOT NULL,
            "IdempotencyKey" character varying(120) NOT NULL,
            "PrimaryRecipient" character varying(200),
            "CcRecipients" character varying(1000),
            "XmlCountIssued" integer NOT NULL DEFAULT 0,
            "XmlCountCanceled" integer NOT NULL DEFAULT 0,
            "SalesCount" integer NOT NULL DEFAULT 0,
            "GrossAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "DiscountAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "CanceledAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "NetAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "AverageTicket" numeric(18,2) NOT NULL DEFAULT 0,
            "PaymentBreakdownJson" text NOT NULL DEFAULT '{{}}',
            "ErrorCode" character varying(100),
            "ErrorMessage" character varying(2000),
            "StartedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
            "FinishedAtUtc" timestamp with time zone,
            "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
            "CreatedBy" character varying(120),
            CONSTRAINT "PK_AccountingDispatchRuns" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AccountingDispatchRuns_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_AccountingDispatchRuns_CompanyId_PeriodReference"
            ON "AccountingDispatchRuns" ("CompanyId", "PeriodReference");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_AccountingDispatchRuns_CompanyId_IdempotencyKey"
            ON "AccountingDispatchRuns" ("CompanyId", "IdempotencyKey");
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "AccountingDispatchAttachments" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "RunId" uuid NOT NULL,
            "AttachmentType" character varying(30) NOT NULL,
            "FileName" character varying(180) NOT NULL,
            "SizeBytes" bigint NOT NULL,
            "ChecksumSha256" character varying(64) NOT NULL,
            "StorageMode" character varying(20) NOT NULL DEFAULT 'Temp',
            "StoragePath" character varying(600),
            "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT "PK_AccountingDispatchAttachments" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AccountingDispatchAttachments_AccountingDispatchRuns_RunId"
                FOREIGN KEY ("RunId") REFERENCES "AccountingDispatchRuns"("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_AccountingDispatchAttachments_CompanyId_RunId"
            ON "AccountingDispatchAttachments" ("CompanyId", "RunId");
        """);

    // Tabela de chaves do Data Protection (LGPD / criptografia)
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "DataProtectionKeys" (
            "Id"           serial  NOT NULL,
            "FriendlyName" text,
            "Xml"          text,
            CONSTRAINT "PK_DataProtectionKeys" PRIMARY KEY ("Id")
        );
        """);

    // Coluna CpfHash para busca de CPF criptografado
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Customers"
        ADD COLUMN IF NOT EXISTS "CpfHash" character varying(64);
        """);

    // Alarga a coluna Cpf para acomodar ciphertext
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "Customers"
        ALTER COLUMN "Cpf" TYPE character varying(500);
        """);

    // Alarga CertificatePassword para acomodar ciphertext
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "FiscalConfigs"
        ALTER COLUMN "CertificatePassword" TYPE character varying(1000);
        """);
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "CashRegisterFiscalConfigs"
        ALTER COLUMN "CertificatePassword" TYPE character varying(1000);
        """);

    // Cria tabela de config fiscal por caixa se ainda não existir (idempotente)
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "CashRegisterFiscalConfigs" (
            "Id"                  uuid NOT NULL DEFAULT gen_random_uuid(),
            "CashRegisterId"      uuid NOT NULL,
            "Cnpj"                character varying(14) NOT NULL DEFAULT '',
            "InscricaoEstadual"   character varying(30) NOT NULL DEFAULT '',
            "Uf"                  character varying(2) NOT NULL DEFAULT '',
            "RazaoSocial"         character varying(60) NOT NULL DEFAULT '',
            "NomeFantasia"        character varying(60),
            "Logradouro"          character varying(60) NOT NULL DEFAULT '',
            "NumeroEndereco"      character varying(60) NOT NULL DEFAULT '',
            "Complemento"         character varying(60),
            "Bairro"              character varying(60) NOT NULL DEFAULT '',
            "CodigoMunicipio"     integer NOT NULL DEFAULT 0,
            "NomeMunicipio"       character varying(60) NOT NULL DEFAULT '',
            "Cep"                 character varying(8) NOT NULL DEFAULT '',
            "Telefone"            character varying(14),
            "TaxRegime"           character varying(30) NOT NULL DEFAULT 'SimplesNacional',
            "DefaultCfop"         character varying(10) NOT NULL DEFAULT '5102',
            "SefazEnvironment"    character varying(20) NOT NULL DEFAULT 'Homologacao',
            "CertificateBase64"   text,
            "CertificatePassword" character varying(200),
            "CscId"               character varying(10),
            "CscToken"            character varying(36),
            "NfceSerie"           smallint NOT NULL DEFAULT 1,
            "IsActive"            boolean NOT NULL DEFAULT true,
            "CreatedAtUtc"        timestamp with time zone NOT NULL DEFAULT now(),
            "UpdatedAtUtc"        timestamp with time zone,
            CONSTRAINT "PK_CashRegisterFiscalConfigs" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_CashRegisterFiscalConfigs_CashRegisters_CashRegisterId"
                FOREIGN KEY ("CashRegisterId") REFERENCES "CashRegisters"("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CashRegisterFiscalConfigs_CashRegisterId"
            ON "CashRegisterFiscalConfigs"("CashRegisterId");
        """);

    // Feature flags por tenant (global + override por empresa)
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "CompanyFeatureOverrides" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "FeatureKey" character varying(80) NOT NULL,
            "IsEnabled" boolean NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_CompanyFeatureOverrides" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_CompanyFeatureOverrides_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CompanyFeatureOverrides_CompanyId_FeatureKey"
            ON "CompanyFeatureOverrides" ("CompanyId", "FeatureKey");
        """);

    // Comissões e gorjetas
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "CommissionConfigs" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "IsEnabled" boolean NOT NULL,
            "IsTipEnabled" boolean NOT NULL,
            "DefaultCommissionPercent" numeric(5,2) NOT NULL,
            "TipDistributionMode" character varying(40) NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_CommissionConfigs" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_CommissionConfigs_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CommissionConfigs_CompanyId"
            ON "CommissionConfigs" ("CompanyId");
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "EmployeeCommissionRates" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "AdminUserId" uuid NOT NULL,
            "CommissionPercent" numeric(5,2) NOT NULL,
            "IsActive" boolean NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_EmployeeCommissionRates" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_EmployeeCommissionRates_AdminUsers_AdminUserId"
                FOREIGN KEY ("AdminUserId") REFERENCES "AdminUsers" ("Id") ON DELETE RESTRICT,
            CONSTRAINT "FK_EmployeeCommissionRates_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_EmployeeCommissionRates_CompanyId_AdminUserId"
            ON "EmployeeCommissionRates" ("CompanyId", "AdminUserId");
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "TipPoolEntries" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "ReferenceDateUtc" timestamp with time zone NOT NULL,
            "AmountCents" integer NOT NULL,
            "Description" character varying(250) NOT NULL,
            "CreatedBy" character varying(120) NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_TipPoolEntries" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_TipPoolEntries_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_TipPoolEntries_CompanyId_ReferenceDateUtc"
            ON "TipPoolEntries" ("CompanyId", "ReferenceDateUtc");
        """);

    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "EmployeeCommissionAdjustments" (
            "Id" uuid NOT NULL,
            "CompanyId" uuid NOT NULL,
            "AdminUserId" uuid NOT NULL,
            "ReferenceDateUtc" timestamp with time zone NOT NULL,
            "AmountCents" integer NOT NULL,
            "Description" character varying(250) NOT NULL,
            "CreatedBy" character varying(120) NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_EmployeeCommissionAdjustments" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_EmployeeCommissionAdjustments_AdminUsers_AdminUserId"
                FOREIGN KEY ("AdminUserId") REFERENCES "AdminUsers" ("Id") ON DELETE RESTRICT,
            CONSTRAINT "FK_EmployeeCommissionAdjustments_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "IX_EmployeeCommissionAdjustments_CompanyId_ReferenceDateUtc_AdminUserId"
            ON "EmployeeCommissionAdjustments" ("CompanyId", "ReferenceDateUtc", "AdminUserId");
        """);

    await DbSeeder.SeedAsync(db);

    // Migração LGPD: criptografa CPFs que ainda estão em plaintext
    using var cpfScope = app.Services.CreateScope();
    var cpfSvc = cpfScope.ServiceProvider.GetRequiredService<Petshop.Api.Services.Customers.CpfProtectionService>();
    var dbForMigration = cpfScope.ServiceProvider.GetRequiredService<Petshop.Api.Data.AppDbContext>();
    var customersToMigrate = await dbForMigration.Customers
        .Where(c => c.Cpf != null && c.CpfHash == null)
        .ToListAsync();
    foreach (var customer in customersToMigrate)
    {
        if (string.IsNullOrWhiteSpace(customer.Cpf)) continue;
        // Se já está criptografado (e CpfHash era null de outro motivo), apenas gera o hash
        var plaintext = Petshop.Api.Services.Customers.CpfProtectionService.IsProtected(customer.Cpf)
            ? cpfSvc.Unprotect(customer.Cpf)
            : customer.Cpf;
        if (plaintext is null) continue;
        customer.Cpf     = cpfSvc.Protect(plaintext);
        customer.CpfHash = cpfSvc.Hash(plaintext);
        customer.UpdatedAtUtc = DateTime.UtcNow;
    }
    if (customersToMigrate.Count > 0)
    {
        await dbForMigration.SaveChangesAsync();
        var logger = cpfScope.ServiceProvider.GetRequiredService<ILogger<Petshop.Api.Data.AppDbContext>>();
        logger.LogInformation("[LGPD] CPF migration: {Count} clientes criptografados.", customersToMigrate.Count);
    }
}

if (app.Environment.IsDevelopment())
{
    // Hangfire Dashboard (dev: sem auth adicional)
    app.UseHangfireDashboard("/admin/hangfire");
}

// Job de sync agendado — roda em todos os ambientes (usa DI, não API estática)
using (var scope = app.Services.CreateScope())
{
    var jobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    jobManager.AddOrUpdate<SyncSchedulerJob>(
        "sync-scheduler",
        j => j.RunScheduledSyncsAsync(CancellationToken.None),
        "* * * * *");

    // Reprocessamento de contingências fiscais — a cada 5 minutos
    jobManager.AddOrUpdate<ContingencyReprocessJob>(
        "fiscal-contingency-reprocess",
        j => j.RunAsync(CancellationToken.None),
        "*/5 * * * *");

    jobManager.AddOrUpdate<AccountingDispatchSchedulerJob>(
        "accounting-dispatch-scan",
        j => j.RunAsync(CancellationToken.None),
        "*/15 * * * *");

    // Arquivamento automático de DAVs abandonados — 1x por dia às 3h
    jobManager.AddOrUpdate<DavAbandonmentJob>(
        "dav-abandonment-cleanup",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 3 * * *");
}

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ===============================
// Middleware Pipeline
// ===============================

// Necessário para funcionar atrás de reverse proxy (Render, Railway, etc.)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Rate limiting após ForwardedHeaders para que o IP real seja lido corretamente
app.UseRateLimiter();

app.UseCors("Frontend");

// ===============================
// Security Headers
// ===============================
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
    if (!app.Environment.IsDevelopment())
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

// ===============================
// Master Admin — feature flag
// Bloqueia /master/* com 404 quando Master:Enabled != "true".
// Posicionado após UseCors para que a resposta 404 leve os headers CORS corretos.
// ===============================
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/master"))
    {
        var masterEnabled = string.Equals(
            app.Configuration["Master:Enabled"],
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (!masterEnabled)
        {
            context.Response.StatusCode = 404;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"Not found.\"}");
            return;
        }
    }
    await next();
});

// Não usar HttpsRedirection atrás de reverse proxy — o proxy já termina o TLS
if (app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseStaticFiles(); // Serve wwwroot/product-images/

app.UseAuthentication();
app.UseAuthorization();

// Valida que token JWT de admin pertence à empresa do subdomínio atual (FASE 3)
app.UseMiddleware<Petshop.Api.Middleware.TenantHostValidationMiddleware>();

app.MapControllers();

// ===============================
// SignalR Hubs
// ===============================
app.MapHub<PrintHub>("/hubs/print").DisableRateLimiting();
app.MapHub<ScaleAgentHub>("/hubs/scale-agent").DisableRateLimiting();

app.Run();
