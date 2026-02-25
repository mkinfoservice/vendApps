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
            .AllowAnyMethod();
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

        var response = new { error = "Erro interno do servidor. Tente novamente mais tarde." };
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    });
});

// ===============================
// Dev-only Middleware
// ===============================
var enableSwagger = app.Environment.IsDevelopment()
    || string.Equals(builder.Configuration["ENABLE_SWAGGER"], "true", StringComparison.OrdinalIgnoreCase);

// Aplica migrations + seed demo em todos os ambientes
// O DbSeeder é idempotente (checa se dados já existem antes de inserir)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
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

app.Run();
