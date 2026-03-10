using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Master;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Gerencia os membros da equipe de uma empresa (atendentes e gerentes).
/// Admin pode criar/editar gerentes e atendentes.
/// Gerente pode criar/editar somente atendentes.
/// Nenhum deles pode alterar usuários com role=admin.
/// </summary>
[ApiController]
[Route("admin/team")]
[Authorize(Roles = "admin,gerente")]
public class StoreUsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<StoreUsersController> _logger;

    public StoreUsersController(AppDbContext db, ILogger<StoreUsersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private Guid GetCompanyId() => Guid.Parse(User.FindFirstValue("companyId")!);
    private string GetCallerRole() => User.FindFirstValue(ClaimTypes.Role)!;

    // GET /admin/team
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var companyId = GetCompanyId();

        var query = _db.AdminUsers
            .AsNoTracking()
            .Where(u => u.CompanyId == companyId && u.Role != "admin");

        if (!includeInactive)
            query = query.Where(u => u.IsActive);

        var members = await query
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Username)
            .Select(u => new StoreUserDto(
                u.Id, u.Username, u.Email,
                u.Role, u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(members);
    }

    // POST /admin/team
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateStoreUserRequest req,
        CancellationToken ct = default)
    {
        var companyId  = GetCompanyId();
        var callerRole = GetCallerRole();

        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { error = "Username é obrigatório." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { error = "Senha deve ter ao menos 6 caracteres." });

        // Gerente só pode criar atendente; Admin pode criar gerente e atendente
        var allowedRoles = callerRole == "admin"
            ? new[] { "gerente", "atendente" }
            : new[] { "atendente" };

        if (!allowedRoles.Contains(req.Role))
            return StatusCode(403, new { error = $"Você não tem permissão para criar usuários com role '{req.Role}'." });

        var username = req.Username.Trim();
        if (await _db.AdminUsers.AnyAsync(u => u.Username == username, ct))
            return Conflict(new { error = $"Username '{username}' já está em uso." });

        var user = new AdminUser
        {
            CompanyId    = companyId,
            Username     = username,
            Email        = req.Email?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role         = req.Role,
        };

        _db.AdminUsers.Add(user);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "👤 Membro {Username} ({Role}) criado na empresa {CompanyId}",
            username, req.Role, companyId);

        return CreatedAtAction(nameof(List), null, MapUser(user));
    }

    // PUT /admin/team/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateStoreUserRequest req,
        CancellationToken ct = default)
    {
        var companyId  = GetCompanyId();
        var callerRole = GetCallerRole();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, ct);

        if (user is null) return NotFound();
        if (user.Role == "admin") return StatusCode(403, new { error = "Não é possível editar o admin principal." });
        if (callerRole == "gerente" && user.Role == "gerente")
            return StatusCode(403, new { error = "Gerente não pode editar outro gerente." });

        if (req.Email is not null)
            user.Email = req.Email.Trim();

        if (!string.IsNullOrWhiteSpace(req.NewPassword))
        {
            if (req.NewPassword.Length < 6)
                return BadRequest(new { error = "Senha deve ter ao menos 6 caracteres." });
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(MapUser(user));
    }

    // DELETE /admin/team/{id}  (soft-delete → IsActive=false)
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(
        Guid id,
        CancellationToken ct = default)
    {
        var companyId  = GetCompanyId();
        var callerRole = GetCallerRole();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, ct);

        if (user is null) return NotFound();
        if (user.Role == "admin") return StatusCode(403, new { error = "Não é possível desativar o admin principal." });
        if (callerRole == "gerente" && user.Role == "gerente")
            return StatusCode(403, new { error = "Gerente não pode desativar outro gerente." });
        if (!user.IsActive) return Conflict(new { error = "Usuário já está desativado." });

        user.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // POST /admin/team/{id}/reactivate
    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(
        Guid id,
        CancellationToken ct = default)
    {
        var companyId  = GetCompanyId();
        var callerRole = GetCallerRole();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId, ct);

        if (user is null) return NotFound();
        if (user.Role == "admin") return StatusCode(403, new { error = "Não é possível reativar o admin principal por aqui." });
        if (callerRole == "gerente" && user.Role == "gerente")
            return StatusCode(403, new { error = "Gerente não pode reativar outro gerente." });
        if (user.IsActive) return Conflict(new { error = "Usuário já está ativo." });

        user.IsActive = true;
        await _db.SaveChangesAsync(ct);
        return Ok(MapUser(user));
    }

    private static StoreUserDto MapUser(AdminUser u) =>
        new(u.Id, u.Username, u.Email, u.Role, u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc);
}

public record StoreUserDto(
    Guid Id,
    string Username,
    string? Email,
    string Role,
    bool IsActive,
    DateTime? LastLoginAtUtc,
    DateTime CreatedAtUtc);

public record CreateStoreUserRequest(
    string Username,
    string Password,
    string? Email,
    string Role);

public record UpdateStoreUserRequest(
    string? Email,
    string? NewPassword);
