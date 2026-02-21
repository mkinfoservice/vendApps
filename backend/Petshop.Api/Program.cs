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
using Petshop.Api.Services;
using Microsoft.OpenApi.Models;
using Petshop.Api.Services.Geocoding;
using Petshop.Api.Services.Images;
using Petshop.Api.Services.Sync;

var builder = WebApplication.CreateBuilder(args);

// ===============================
// Controllers
// ===============================
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
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

// ===============================
// Services — Imagens
// ===============================
builder.Services.AddScoped<IImageStorageProvider, LocalImageStorageProvider>();

// ===============================
// CORS
// ===============================
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
                origin.StartsWith("http://localhost") ||
                origin.StartsWith("http://127.0.0.1"))
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
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbSeeder.SeedAsync(db);

    app.UseSwagger();
    app.UseSwaggerUI();

    // Hangfire Dashboard (dev: sem auth adicional)
    app.UseHangfireDashboard("/admin/hangfire");

    // Registrar job de sync agendado (verifica a cada minuto)
    RecurringJob.AddOrUpdate<SyncSchedulerJob>(
        "sync-scheduler",
        j => j.RunScheduledSyncsAsync(CancellationToken.None),
        "* * * * *");
}

// ===============================
// Middleware Pipeline
// ===============================
app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseStaticFiles(); // Serve wwwroot/product-images/

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
