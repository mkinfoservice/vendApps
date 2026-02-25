using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Petshop.Api.Contracts.Auth;
using Petshop.Api.Data;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public AuthController(IConfiguration config, AppDbContext db)
    {
        _config = config;
        _db = db;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] AdminLoginRequest req,
        CancellationToken ct = default)
    {
        var jwt = _config.GetSection("Jwt");
        var staticUser = jwt["AdminUser"];
        var staticPass = jwt["AdminPassword"];

        // 1. Credenciais estáticas (compatibilidade total com comportamento anterior)
        if (req.Username == staticUser && req.Password == staticPass)
        {
            var companyId = jwt["CompanyId"] ?? Petshop.Api.Data.DbSeeder.DevCompanyId.ToString();

            var token = GenerateToken(new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, req.Username),
                new(ClaimTypes.Name, req.Username),
                new(ClaimTypes.Role, "admin"),
                new("companyId", companyId),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            });

            return Ok(new AdminLoginResponse(token));
        }

        // 2. AdminUsers criados pelo Wizard (BCrypt)
        var adminUser = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Username == req.Username.Trim() && u.IsActive, ct);

        if (adminUser is null || !BCrypt.Net.BCrypt.Verify(req.Password, adminUser.PasswordHash))
            return Unauthorized("Credenciais inválidas.");

        if (adminUser.CompanyId is null)
            return Unauthorized("Esta conta não possui empresa associada.");

        adminUser.LastLoginAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var adminToken = GenerateToken(new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, adminUser.Username),
            new(ClaimTypes.Name, adminUser.Username),
            new(ClaimTypes.Role, "admin"),
            new("companyId", adminUser.CompanyId.ToString()!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        });

        return Ok(new AdminLoginResponse(adminToken));
    }

    [HttpPost("deliverer/login")]
    public async Task<IActionResult> DelivererLogin(
        [FromBody] DelivererLoginRequest req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Phone) || string.IsNullOrWhiteSpace(req.Pin))
            return BadRequest("Phone e Pin são obrigatórios.");

        var phone = req.Phone.Trim();
        var deliverer = await _db.Deliverers
            .FirstOrDefaultAsync(d => d.Phone == phone, ct);

        if (deliverer is null)
            return Unauthorized("Credenciais inválidas.");

        if (string.IsNullOrEmpty(deliverer.PinHash))
            return Unauthorized("Entregador sem PIN cadastrado. Contate o admin.");

        if (!BCrypt.Net.BCrypt.Verify(req.Pin.Trim(), deliverer.PinHash))
            return Unauthorized("Credenciais inválidas.");

        if (!deliverer.IsActive)
            return Unauthorized("Entregador inativo. Contate o admin.");

        var token = GenerateToken(new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, deliverer.Id.ToString()),
            new(ClaimTypes.Name, deliverer.Name),
            new(ClaimTypes.Role, "deliverer"),
            new("delivererId", deliverer.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        });

        return Ok(new DelivererLoginResponse(token, deliverer.Id, deliverer.Name));
    }

    private string GenerateToken(List<Claim> claims)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
