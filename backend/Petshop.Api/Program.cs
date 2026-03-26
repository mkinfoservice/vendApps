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

// OpenFoodFacts: HttpClient tipado (busca por barcode — alimentos em geral)
builder.Services.AddHttpClient<OpenFoodFactsClient>(client =>
{
    client.BaseAddress = new Uri("https://world.openfoodfacts.org/");
    client.Timeout     = TimeSpan.FromSeconds(8);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("vendApps-enrichment/1.0");
});

// OpenPetFoodFacts: HttpClient tipado (busca por barcode — pet food específico)
builder.Services.AddHttpClient<OpenPetFoodFactsClient>(client =>
{
    client.BaseAddress = new Uri("https://world.openpetfoodfacts.org/");
    client.Timeout     = TimeSpan.FromSeconds(8);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("vendApps-enrichment/1.0");
});

// Busca por nome (named client — sem base URL fixa, usa OFF e OPFF)
builder.Services.AddHttpClient("EnrichmentNameSearch", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("vendApps-enrichment/1.0");
});

// ML Token Service — obtém e armazena em cache o access token via client credentials
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<MlTokenService>();

// Named HttpClient compartilhado para chamadas ao Mercado Livre
// MercadoLivreImageMatcher usa IHttpClientFactory + CreateClient("MercadoLivre")
// e injeta o Bearer token por request (não em DefaultRequestHeaders do singleton)
builder.Services.AddHttpClient("MercadoLivre", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; vendApps/1.0)");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// Registra todos os matchers de imagem (executados em ordem pelo ProductImageMatchingService)
// ML primeiro (melhor cobertura para mercado BR), depois as bases pet food internacionais
builder.Services.AddScoped<MercadoLivreImageMatcher>(); // registro direto para injeção no controller
builder.Services.AddScoped<IProductImageMatcher, MercadoLivreImageMatcher>();
builder.Services.AddScoped<IProductImageMatcher, OpenPetFoodFactsClient>();
builder.Services.AddScoped<IProductImageMatcher, OpenFoodFactsClient>();
builder.Services.AddScoped<IProductImageMatcher, ProductNameImageSearchMatcher>();
// Registro direto para injeção no CatalogEnrichmentController (picker fallback)
builder.Services.AddScoped<ProductNameImageSearchMatcher>();

// ===============================
// Services — Master Admin
// ===============================
builder.Services.AddDataProtection();
builder.Services.AddScoped<Petshop.Api.Services.Master.MasterAuditService>();
builder.Services.AddScoped<Petshop.Api.Services.Master.MasterCryptoService>();

// ===============================
// Services — Tenant
// ===============================
builder.Services.AddScoped<Petshop.Api.Services.TenantResolverService>();

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
builder.Services.AddScoped<ContingencyReprocessJob>();

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

        // Temporário: expõe detalhe em produção para diagnóstico — remover após estabilizar
        object response = exceptionFeature != null
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

    // Garante colunas que podem ter ficado fora das migrations (idempotente)
    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE "FiscalConfigs"
        ADD COLUMN IF NOT EXISTS "CertificateBase64" text;
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

    await DbSeeder.SeedAsync(db);
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

app.UseCors("Frontend");

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
app.MapHub<PrintHub>("/hubs/print");
app.MapHub<ScaleAgentHub>("/hubs/scale-agent");

app.Run();
