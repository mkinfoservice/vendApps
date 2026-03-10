using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Services.Geocoding;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/customers")]
[Authorize(Roles = "admin,gerente,atendente")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ViaCepService _viaCep;
    private readonly IGeocodingService _geo;
    private readonly ILogger<CustomersController> _logger;

    public CustomersController(
        AppDbContext db,
        ViaCepService viaCep,
        IGeocodingService geo,
        ILogger<CustomersController> logger)
    {
        _db = db;
        _viaCep = viaCep;
        _geo = geo;
        _logger = logger;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/customers ──────────────────────────────────────────────────
    /// <summary>Lista e busca clientes da empresa.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? phone,
        [FromQuery] string? name,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var q = _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var cleaned = CleanPhone(phone);
            q = q.Where(c => c.Phone.Contains(cleaned));
        }

        if (!string.IsNullOrWhiteSpace(name))
            q = q.Where(c => EF.Functions.ILike(c.Name, $"%{name.Trim()}%"));

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CustomerListItem(
                c.Id, c.Name, c.Phone, c.Cpf,
                c.Address, c.Neighborhood, c.City, c.State,
                c.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(new { page, pageSize, total, items });
    }

    // ── GET /admin/customers/by-phone/{phone} ────────────────────────────────
    /// <summary>Busca rápida por telefone exato — usado no fluxo de pedido telefônico.</summary>
    [HttpGet("by-phone/{phone}")]
    public async Task<IActionResult> ByPhone(string phone, CancellationToken ct = default)
    {
        var cleaned = CleanPhone(phone);
        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId && c.Phone == cleaned)
            .Select(c => new CustomerDetailDto(
                c.Id, c.Name, c.Phone, c.Cpf,
                c.Cep, c.Address, c.Complement, c.Neighborhood,
                c.City, c.State, c.AddressReference, c.Notes,
                c.Latitude, c.Longitude, c.CreatedAtUtc, c.UpdatedAtUtc,
                null))
            .FirstOrDefaultAsync(ct);

        if (customer is null) return NotFound();
        return Ok(customer);
    }

    // ── GET /admin/customers/{id} ─────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var c = await _db.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == CompanyId, ct);

        if (c is null) return NotFound();

        // Últimos 20 pedidos do cliente
        var orders = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == id)
            .OrderByDescending(o => o.CreatedAtUtc)
            .Take(20)
            .Select(o => new CustomerOrderSummary(
                o.Id, o.PublicId, o.Status.ToString(),
                o.TotalCents, o.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(new CustomerDetailDto(
            c.Id, c.Name, c.Phone, c.Cpf,
            c.Cep, c.Address, c.Complement, c.Neighborhood,
            c.City, c.State, c.AddressReference, c.Notes,
            c.Latitude, c.Longitude, c.CreatedAtUtc, c.UpdatedAtUtc,
            orders));
    }

    // ── POST /admin/customers ─────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] UpsertCustomerRequest req,
        CancellationToken ct = default)
    {
        var err = ValidateRequest(req);
        if (err is not null) return BadRequest(new { error = err });

        var phone = CleanPhone(req.Phone);

        if (await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.Phone == phone, ct))
            return Conflict(new { error = $"Já existe um cliente com o telefone '{req.Phone}'." });

        var customer = new Customer
        {
            CompanyId = CompanyId,
            Name      = req.Name.Trim(),
            Phone     = phone,
            Cpf       = CleanCpf(req.Cpf),
            Cep       = CleanCep(req.Cep),
            Address   = req.Address?.Trim(),
            Complement       = req.Complement?.Trim(),
            AddressReference = req.AddressReference?.Trim(),
            Notes     = req.Notes?.Trim(),
        };

        if (req.Latitude.HasValue && req.Longitude.HasValue)
        {
            // Coords from frontend mini-map pin — enrich neighbourhood/city via ViaCEP but keep explicit coords
            await EnrichAddressAsync(customer, ct);
            customer.Latitude      = req.Latitude.Value;
            customer.Longitude     = req.Longitude.Value;
            customer.GeocodedAtUtc = DateTime.UtcNow;
        }
        else
        {
            // Enriquece via ViaCEP + geocodifica automaticamente
            await EnrichAddressAsync(customer, ct);
        }

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "👤 Cliente {Name} ({Phone}) criado na empresa {CompanyId}",
            customer.Name, customer.Phone, CompanyId);

        return CreatedAtAction(nameof(GetById), new { id = customer.Id },
            MapDetail(customer, null));
    }

    // ── PUT /admin/customers/{id} ─────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpsertCustomerRequest req,
        CancellationToken ct = default)
    {
        var err = ValidateRequest(req);
        if (err is not null) return BadRequest(new { error = err });

        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == CompanyId, ct);

        if (customer is null) return NotFound();

        var phone = CleanPhone(req.Phone);

        // Garante que não conflita com outro cliente
        if (customer.Phone != phone &&
            await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.Phone == phone && c.Id != id, ct))
            return Conflict(new { error = $"Já existe outro cliente com o telefone '{req.Phone}'." });

        bool addressChanged =
            CleanCep(req.Cep) != customer.Cep ||
            req.Address?.Trim() != customer.Address;

        customer.Name      = req.Name.Trim();
        customer.Phone     = phone;
        customer.Cpf       = CleanCpf(req.Cpf);
        customer.Cep       = CleanCep(req.Cep);
        customer.Address   = req.Address?.Trim();
        customer.Complement       = req.Complement?.Trim();
        customer.AddressReference = req.AddressReference?.Trim();
        customer.Notes     = req.Notes?.Trim();
        customer.UpdatedAtUtc = DateTime.UtcNow;

        if (req.Latitude.HasValue && req.Longitude.HasValue)
        {
            // Coords from frontend mini-map pin override any geocoding
            if (addressChanged) await EnrichAddressAsync(customer, ct); // still get neighbourhood/city
            customer.Latitude      = req.Latitude.Value;
            customer.Longitude     = req.Longitude.Value;
            customer.GeocodedAtUtc = DateTime.UtcNow;
        }
        else if (addressChanged)
        {
            customer.Latitude      = null;
            customer.Longitude     = null;
            customer.GeocodedAtUtc = null;
            await EnrichAddressAsync(customer, ct);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(MapDetail(customer, null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task EnrichAddressAsync(Customer customer, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(customer.Cep)) return;

        var viaCep = await _viaCep.GetAddressAsync(customer.Cep, ct);
        if (viaCep != null && !viaCep.Erro)
        {
            customer.Neighborhood = viaCep.Bairro?.Trim();
            customer.City         = viaCep.Localidade?.Trim();
            customer.State        = viaCep.Uf?.Trim();

            // Geocodifica o endereço completo
            if (!string.IsNullOrWhiteSpace(customer.Address))
            {
                var numMatch    = Regex.Match(customer.Address, @"[Nn]\.?º?\s*(\d+)");
                var houseNumber = numMatch.Success ? numMatch.Groups[1].Value : "";

                var parts = new List<string> { viaCep.Logradouro ?? customer.Address };
                if (!string.IsNullOrEmpty(houseNumber)) parts.Add(houseNumber);
                if (!string.IsNullOrEmpty(viaCep.Bairro)) parts.Add(viaCep.Bairro);
                parts.Add(viaCep.Localidade ?? "");
                parts.Add(viaCep.Uf ?? "");
                parts.Add("Brasil");

                var geoQuery = string.Join(", ", parts.Where(p => !string.IsNullOrEmpty(p)));
                var coords   = await _geo.GeocodeAsync(geoQuery, ct);
                if (coords.HasValue)
                {
                    customer.Latitude      = coords.Value.lat;
                    customer.Longitude     = coords.Value.lon;
                    customer.GeocodedAtUtc = DateTime.UtcNow;
                }
            }
        }
    }

    private static string? ValidateRequest(UpsertCustomerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))   return "Nome é obrigatório.";
        if (string.IsNullOrWhiteSpace(req.Phone))  return "Telefone é obrigatório.";
        return null;
    }

    private static string CleanPhone(string phone) =>
        Regex.Replace(phone, @"\D", "");

    private static string? CleanCpf(string? cpf) =>
        string.IsNullOrWhiteSpace(cpf) ? null : Regex.Replace(cpf, @"\D", "");

    private static string? CleanCep(string? cep) =>
        string.IsNullOrWhiteSpace(cep) ? null : Regex.Replace(cep, @"\D", "");

    private static CustomerDetailDto MapDetail(Customer c, List<CustomerOrderSummary>? orders) =>
        new(c.Id, c.Name, c.Phone, c.Cpf,
            c.Cep, c.Address, c.Complement, c.Neighborhood,
            c.City, c.State, c.AddressReference, c.Notes,
            c.Latitude, c.Longitude, c.CreatedAtUtc, c.UpdatedAtUtc,
            orders);
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record UpsertCustomerRequest(
    string Name,
    string Phone,
    string? Cpf,
    string? Cep,
    string? Address,
    string? Complement,
    string? AddressReference,
    string? Notes,
    double? Latitude,
    double? Longitude);

public record CustomerListItem(
    Guid Id,
    string Name,
    string Phone,
    string? Cpf,
    string? Address,
    string? Neighborhood,
    string? City,
    string? State,
    DateTime UpdatedAtUtc);

public record CustomerDetailDto(
    Guid Id,
    string Name,
    string Phone,
    string? Cpf,
    string? Cep,
    string? Address,
    string? Complement,
    string? Neighborhood,
    string? City,
    string? State,
    string? AddressReference,
    string? Notes,
    double? Latitude,
    double? Longitude,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    List<CustomerOrderSummary>? Orders);

public record CustomerOrderSummary(
    Guid Id,
    string PublicId,
    string Status,
    int TotalCents,
    DateTime CreatedAtUtc);
