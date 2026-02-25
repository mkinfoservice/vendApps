using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Petshop.Api.Contracts.Master;

namespace Petshop.Api.Controllers;

/// <summary>
/// Autenticação do Master Admin.
/// Requer feature flag Master:Enabled=true e credenciais Master:User / Master:Password.
/// </summary>
[ApiController]
[Route("master")]
public class MasterAuthController : ControllerBase
{
    private readonly IConfiguration _config;

    public MasterAuthController(IConfiguration config)
    {
        _config = config;
    }

    /// <summary>
    /// POST /master/auth/login
    /// Retorna JWT com role=master_admin (sem companyId).
    /// </summary>
    [HttpPost("auth/login")]
    public IActionResult Login([FromBody] MasterLoginRequest req)
    {
        var masterUser = _config["Master:User"];
        var masterPassword = _config["Master:Password"];

        if (string.IsNullOrWhiteSpace(masterUser) || string.IsNullOrWhiteSpace(masterPassword))
            return StatusCode(503, new { error = "Master admin não configurado neste ambiente." });

        if (req.Username != masterUser || req.Password != masterPassword)
            return Unauthorized(new { error = "Credenciais inválidas." });

        var expiresAt = DateTime.UtcNow.AddHours(8);
        var token = GenerateToken(req.Username, expiresAt);

        return Ok(new MasterLoginResponse(token, "master_admin", expiresAt));
    }

    private string GenerateToken(string username, DateTime expiresAt)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, username),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, "master_admin"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
