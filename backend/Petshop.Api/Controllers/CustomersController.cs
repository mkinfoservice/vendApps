using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Customers;
using Petshop.Api.Services.Customers;
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
    private readonly LoyaltyService _loyalty;
    private readonly CpfProtectionService _cpfSvc;

    public CustomersController(
        AppDbContext db,
        ViaCepService viaCep,
        IGeocodingService geo,
        ILogger<CustomersController> logger,
        LoyaltyService loyalty,
        CpfProtectionService cpfSvc)
    {
        _db = db;
        _viaCep = viaCep;
        _geo = geo;
        _loyalty = loyalty;
        _logger = logger;
        _cpfSvc = cpfSvc;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // -- GET /admin/customers --------------------------------------------------
    /// <summary>Lista e busca clientes da empresa.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? phone,
        [FromQuery] string? name,
        [FromQuery] bool includeSensitive = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var q = _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim();
            var digits = Regex.Replace(trimmed, @"\D", "");
            var cpfHash = digits.Length == 11 ? _cpfSvc.Hash(digits) : null;
            q = q.Where(c =>
                EF.Functions.ILike(c.Name, $"%{trimmed}%") ||
                (c.Phone != null && c.Phone.Contains(digits)) ||
                (cpfHash != null && c.CpfHash == cpfHash));
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var cleaned = CleanPhone(phone);
            q = q.Where(c => c.Phone.Contains(cleaned));
        }

        if (!string.IsNullOrWhiteSpace(name))
            q = q.Where(c => EF.Functions.ILike(c.Name, $"%{name.Trim()}%"));

        var total = await q.CountAsync(ct);
        var canViewSensitive = includeSensitive && CanViewSensitiveCpf();
        var rawItems = await q
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = rawItems.Select(c => new CustomerListItem(
            c.Id, c.Name, c.Phone, canViewSensitive ? _cpfSvc.Unprotect(c.Cpf) : null,
            c.Address, c.Neighborhood, c.City, c.State,
            c.PointsBalance, c.TotalOrders, c.LastOrderUtc,
            c.UpdatedAtUtc)).ToList();

        return Ok(new { page, pageSize, total, items });
    }

    // -- GET /admin/customers/by-phone/{phone} --------------------------------
    /// <summary>Busca rápida por telefone exato — usado no fluxo de pedido telefônico.</summary>
    [HttpGet("by-phone/{phone}")]
    public async Task<IActionResult> ByPhone(string phone, CancellationToken ct = default)
    {
        var cleaned = CleanPhone(phone);
        var c2 = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == CompanyId && c.Phone == cleaned)
            .FirstOrDefaultAsync(ct);

        if (c2 is null) return NotFound();
        return Ok(MapDetail(c2, null, CanViewSensitiveCpf()));
    }

    // -- GET /admin/customers/{id} ---------------------------------------------
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
            c.Id, c.Name, c.Phone, CanViewSensitiveCpf() ? _cpfSvc.Unprotect(c.Cpf) : null,
            c.Cep, c.Address, c.Complement, c.Neighborhood,
            c.City, c.State, c.AddressReference, c.Notes,
            c.Latitude, c.Longitude, c.CreatedAtUtc, c.UpdatedAtUtc,
            orders));
    }

    // -- POST /admin/customers -------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] UpsertCustomerRequest req,
        CancellationToken ct = default)
    {
        var err = ValidateRequest(req);
        if (err is not null) return BadRequest(new { error = err });

        var phone = CleanPhone(req.Phone);
        var cpf = CpfValidator.Normalize(req.Cpf);

        if (!string.IsNullOrWhiteSpace(cpf) && !CpfValidator.IsValid(cpf))
            return BadRequest(new { error = "CPF inválido." });

        if (!string.IsNullOrWhiteSpace(phone) &&
            await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.Phone == phone, ct))
            return Conflict(new { error = $"Já existe um cliente com o telefone '{req.Phone}'." });

        string? cpfHash = null;
        if (!string.IsNullOrWhiteSpace(cpf))
        {
            cpfHash = _cpfSvc.Hash(cpf);
            if (await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.CpfHash == cpfHash, ct))
                return Conflict(new { error = $"Já existe um cliente com o CPF '{req.Cpf}'." });
        }

        var customer = new Customer
        {
            CompanyId = CompanyId,
            Name      = req.Name.Trim(),
            Phone     = phone,
            Cpf       = _cpfSvc.Protect(cpf),
            CpfHash   = cpfHash,
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
            "?? Cliente {Name} ({Phone}) criado na empresa {CompanyId}",
            customer.Name, customer.Phone, CompanyId);

        return CreatedAtAction(nameof(GetById), new { id = customer.Id },
            MapDetail(customer, null, CanViewSensitiveCpf()));
    }

    // -- PUT /admin/customers/{id} ---------------------------------------------
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
        var cpf = CpfValidator.Normalize(req.Cpf);

        if (!string.IsNullOrWhiteSpace(cpf) && !CpfValidator.IsValid(cpf))
            return BadRequest(new { error = "CPF inválido." });

        // Garante que não conflita com outro cliente
        if (!string.IsNullOrWhiteSpace(phone) &&
            customer.Phone != phone &&
            await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.Phone == phone && c.Id != id, ct))
            return Conflict(new { error = $"Já existe outro cliente com o telefone '{req.Phone}'." });

        string? cpfHash = !string.IsNullOrWhiteSpace(cpf) ? _cpfSvc.Hash(cpf) : null;
        if (!string.IsNullOrWhiteSpace(cpf) &&
            customer.CpfHash != cpfHash &&
            await _db.Customers.AnyAsync(c => c.CompanyId == CompanyId && c.CpfHash == cpfHash && c.Id != id, ct))
            return Conflict(new { error = $"Já existe outro cliente com o CPF '{req.Cpf}'." });

        bool addressChanged =
            CleanCep(req.Cep) != customer.Cep ||
            req.Address?.Trim() != customer.Address;

        customer.Name      = req.Name.Trim();
        customer.Phone     = phone;
        customer.Cpf       = _cpfSvc.Protect(cpf);
        customer.CpfHash   = cpfHash;
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
        return Ok(MapDetail(customer, null, CanViewSensitiveCpf()));
    }

    // -- Helpers ---------------------------------------------------------------

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
        if (string.IsNullOrWhiteSpace(req.Name)) return "Nome é obrigatório.";
        if (string.IsNullOrWhiteSpace(req.Phone) && string.IsNullOrWhiteSpace(req.Cpf))
            return "Informe ao menos telefone ou CPF.";
        return null;
    }

    private static string CleanPhone(string? phone) =>
        string.IsNullOrWhiteSpace(phone) ? "" : Regex.Replace(phone, @"\D", "");

    private static string? CleanCep(string? cep) =>
        string.IsNullOrWhiteSpace(cep) ? null : Regex.Replace(cep, @"\D", "");

    private CustomerDetailDto MapDetail(Customer c, List<CustomerOrderSummary>? orders, bool includeSensitiveCpf) =>
        new(c.Id, c.Name, c.Phone, includeSensitiveCpf ? _cpfSvc.Unprotect(c.Cpf) : null,
            c.Cep, c.Address, c.Complement, c.Neighborhood,
            c.City, c.State, c.AddressReference, c.Notes,
            c.Latitude, c.Longitude, c.CreatedAtUtc, c.UpdatedAtUtc,
            orders);

    // --------------------------------------------------------------------------
    // FIDELIDADE (Fase 9)
    // --------------------------------------------------------------------------

    // GET /admin/customers/{id}/loyalty
    [HttpGet("{id:guid}/loyalty")]
    public async Task<IActionResult> GetLoyalty(Guid id, CancellationToken ct)
    {
        var c = await _db.Customers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);
        if (c is null) return NotFound();

        var txns = await _db.LoyaltyTransactions.AsNoTracking()
            .Where(t => t.CustomerId == id)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(50)
            .Select(t => new LoyaltyTxnDto(
                t.Id, t.Points, t.BalanceBefore, t.BalanceAfter,
                t.Description, t.SaleOrderId, t.CreatedAtUtc))
            .ToListAsync(ct);

        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);

        return Ok(new CustomerLoyaltyDto(
            c.Id, c.Name, c.PointsBalance, c.TotalOrders, c.TotalSpentCents,
            c.LastOrderUtc, cfg.PointsPerReais, cfg.MinRedemptionPoints, txns));
    }

    // POST /admin/customers/{id}/loyalty/adjust
    [HttpPost("{id:guid}/loyalty/adjust")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> AdjustPoints(
        Guid id, [FromBody] AdjustLoyaltyRequest req, CancellationToken ct)
    {
        try
        {
            await _loyalty.AdjustAsync(CompanyId, id, req.Points, req.Reason, ct);
            var c = await _db.Customers.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id, ct);
            return Ok(new { PointsBalance = c?.PointsBalance ?? 0 });
        }
        catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
    }

    // GET /admin/loyalty/config
    [HttpGet("/admin/loyalty/config")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);
        return Ok(MapConfig(cfg));
    }

    // PUT /admin/loyalty/config
    [HttpPut("/admin/loyalty/config")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> UpdateConfig([FromBody] LoyaltyConfigDto req, CancellationToken ct)
    {
        var cfg = await _loyalty.GetOrCreateConfigAsync(CompanyId, ct);
        cfg.IsEnabled           = req.IsEnabled;
        cfg.PointsPerReal       = req.PointsPerReal;
        cfg.PointsPerReais      = req.PointsPerReais;
        cfg.MinRedemptionPoints = req.MinRedemptionPoints;
        cfg.MaxDiscountPercent  = req.MaxDiscountPercent;
        cfg.UpdatedAtUtc        = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(MapConfig(cfg));
    }

    // GET /admin/customers/lookup?q=cpf_or_phone
    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(
        [FromQuery] string q, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest();
        var term = Regex.Replace(q, @"\D", "");

        var termHash = _cpfSvc.Hash(term);
        var c = await _db.Customers.AsNoTracking()
            .Where(x => x.CompanyId == CompanyId)
            .Where(x => (x.CpfHash != null && x.CpfHash == termHash) ||
                        (x.Phone != null && x.Phone == term))
            .FirstOrDefaultAsync(ct);

        if (c is null) return NotFound();
        return Ok(new CustomerLookupResult(
            c.Id, c.Name, c.Phone, CanViewSensitiveCpf() ? _cpfSvc.Unprotect(c.Cpf) : null,
            c.PointsBalance, c.Email, c.BirthDate));
    }

    private bool CanViewSensitiveCpf()
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role");
        return string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(role, "master_admin", StringComparison.OrdinalIgnoreCase);
    }

    private static LoyaltyConfigDto MapConfig(LoyaltyConfig cfg) => new(
        cfg.IsEnabled, cfg.PointsPerReal, cfg.PointsPerReais,
        cfg.MinRedemptionPoints, cfg.MaxDiscountPercent, cfg.UpdatedAtUtc);

    // ── LGPD: anonimização de cliente ─────────────────────────────────────────

    /// <summary>
    /// Anonimiza todos os dados pessoais do cliente conforme LGPD (Lei 13.709/2018).
    /// Preserva o registro e o histórico de pedidos, mas remove dados identificáveis.
    /// Requer role admin ou gerente.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> Anonymize(Guid id, CancellationToken ct)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == id && c.CompanyId == CompanyId)
            .FirstOrDefaultAsync(ct);

        if (customer is null) return NotFound();

        customer.Name            = "Cliente Removido";
        customer.Phone           = $"deleted_{id:N}";
        customer.Cpf             = null;
        customer.CpfHash         = null;
        customer.Email           = null;
        customer.BirthDate       = null;
        customer.Cep             = null;
        customer.Address         = null;
        customer.Complement      = null;
        customer.Neighborhood    = null;
        customer.City            = null;
        customer.State           = null;
        customer.AddressReference = null;
        customer.Notes           = null;
        customer.Latitude        = null;
        customer.Longitude       = null;
        customer.GeocodedAtUtc   = null;
        customer.UpdatedAtUtc    = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[LGPD] Cliente {Id} anonimizado pela empresa {CompanyId}", id, CompanyId);

        return NoContent();
    }
}

// -- DTOs ---------------------------------------------------------------------

public record UpsertCustomerRequest(
    string Name,
    string? Phone,
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
    int PointsBalance,
    int TotalOrders,
    DateTime? LastOrderUtc,
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

public record LoyaltyTxnDto(
    Guid      Id,
    int       Points,
    int       BalanceBefore,
    int       BalanceAfter,
    string    Description,
    Guid?     SaleOrderId,
    DateTime  CreatedAtUtc
);

public record CustomerLoyaltyDto(
    Guid      CustomerId,
    string    CustomerName,
    int       PointsBalance,
    int       TotalOrders,
    int       TotalSpentCents,
    DateTime? LastOrderUtc,
    int       PointsPerReais,
    int       MinRedemptionPoints,
    List<LoyaltyTxnDto> Transactions
);

public record LoyaltyConfigDto(
    bool     IsEnabled,
    decimal  PointsPerReal,
    int      PointsPerReais,
    int      MinRedemptionPoints,
    int      MaxDiscountPercent,
    DateTime UpdatedAtUtc
);

public record AdjustLoyaltyRequest(int Points, string Reason);

public record CustomerLookupResult(
    Guid      Id,
    string    Name,
    string    Phone,
    string?   Cpf,
    int       PointsBalance,
    string?   Email,
    DateOnly? BirthDate
);

