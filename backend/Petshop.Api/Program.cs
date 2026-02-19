using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using Petshop.Api.Services;
using Microsoft.OpenApi.Models;
using Petshop.Api.Services.Geocoding;

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
        Title = "Petshop API",
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
// Services
// ===============================
builder.Services.AddScoped<DeliveryManagementService>();
builder.Services.AddScoped<RouteOptimizationService>();
builder.Services.AddScoped<RouteStopTransitionService>();

// ✅ Serviços de Roteamento Bidirecional
builder.Services.AddScoped<Petshop.Api.Services.Routes.DepotService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.GeofencingService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.NeighborhoodClassificationService>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.RouteSideValidator>();
builder.Services.AddScoped<Petshop.Api.Services.Routes.RoutePreviewService>();

// ✅ ORS Matrix API para otimização de rotas com tempo real de trajeto
builder.Services.AddHttpClient<OrsMatrixService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15); // Matrix API pode demorar mais
});

// ✅ ViaCEP - Enriquecimento de endereço via CEP (gratuito, 100% BR)
builder.Services.AddHttpClient<ViaCepService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});

// ✅ Configuração de Geocoding com Fallback Automático
builder.Services.AddHttpClient<OrsGeocodingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddHttpClient<NominatimGeocodingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// ✅ SISTEMA DE FALLBACK AUTOMÁTICO:
// 1. Tenta ORS primeiro (mais preciso para RJ)
// 2. Se ORS falhar, tenta Nominatim automaticamente
// 3. Retorna null apenas se AMBOS falharem
builder.Services.AddScoped<IGeocodingService, FallbackGeocodingService>();

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

// ===============================
// EF Core + PostgreSQL
// ===============================
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var cs = builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(cs);
});

var app = builder.Build();

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
}

// ===============================
// Middleware Pipeline
// ===============================
app.UseCors("Frontend");
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
