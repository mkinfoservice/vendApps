using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Master.Companies;
using Petshop.Api.Data;
using Petshop.Api.Entities.Master;
using Petshop.Api.Services.Master;

namespace Petshop.Api.Controllers;

/// <summary>
/// Gerencia os AdminUsers de cada empresa (tenant) pelo Master Admin.
/// Todos os endpoints exigem role=master_admin e Master:Enabled=true.
/// </summary>
[ApiController]
[Route("master/companies/{companyId:guid}/admins")]
[Authorize(Roles = "master_admin")]
public class MasterAdminsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MasterAuditService _audit;

    public MasterAdminsController(AppDbContext db, MasterAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    // ── GET /master/companies/{companyId}/admins ───────────────

    /// <summary>
    /// Lista admins da empresa. Por padrão retorna apenas ativos.
    /// ?includeInactive=true para incluir desativados.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        Guid companyId,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        if (!await _db.Companies.AnyAsync(c => c.Id == companyId && !c.IsDeleted, ct))
            return NotFound();

        var query = _db.AdminUsers
            .AsNoTracking()
            .Where(u => u.CompanyId == companyId);

        if (!includeInactive)
            query = query.Where(u => u.IsActive);

        var users = await query
            .OrderBy(u => u.Username)
            .Select(u => new AdminUserDto(
                u.Id, u.CompanyId, u.Username, u.Email,
                u.Role, u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(new ListAdminUsersResponse(users, users.Count));
    }

    // ── POST /master/companies/{companyId}/admins ──────────────

    /// <summary>
    /// Cria um novo AdminUser para a empresa.
    /// O username deve ser globalmente único (não se repete entre empresas).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        Guid companyId,
        [FromBody] CreateAdminUserRequest req,
        CancellationToken ct = default)
    {
        var company = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == companyId && !c.IsDeleted, ct);
        if (company is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { error = "Username é obrigatório." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { error = "Password deve ter ao menos 6 caracteres." });

        var username = req.Username.Trim();
        if (await _db.AdminUsers.AnyAsync(u => u.Username == username, ct))
            return Conflict(new { error = $"Username '{username}' já está em uso." });

        var adminUser = new AdminUser
        {
            CompanyId    = companyId,
            Username     = username,
            Email        = req.Email?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role         = "admin",
        };

        _db.AdminUsers.Add(adminUser);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "admin_user.create", "admin_user",
            adminUser.Id.ToString(), adminUser.Username,
            new { companyId, username = adminUser.Username, email = adminUser.Email }, ct);

        return CreatedAtAction(nameof(List), new { companyId },
            MapUser(adminUser));
    }

    // ── DELETE /master/companies/{companyId}/admins/{adminId} ──

    /// <summary>
    /// Desativa um AdminUser (soft delete — IsActive=false).
    /// O usuário perde o acesso mas permanece no histórico de auditoria.
    /// </summary>
    [HttpDelete("{adminId:guid}")]
    public async Task<IActionResult> Deactivate(
        Guid companyId,
        Guid adminId,
        CancellationToken ct = default)
    {
        if (!await _db.Companies.AnyAsync(c => c.Id == companyId && !c.IsDeleted, ct))
            return NotFound();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == adminId && u.CompanyId == companyId, ct);

        if (user is null) return NotFound();
        if (!user.IsActive) return Conflict(new { error = "Usuário já está desativado." });

        user.IsActive = false;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "admin_user.deactivate", "admin_user",
            adminId.ToString(), user.Username, null, ct);

        return NoContent();
    }

    // ── POST /master/companies/{companyId}/admins/{adminId}/reset-password ──

    /// <summary>
    /// Redefine a senha de um AdminUser. Funciona mesmo se o usuário estiver desativado.
    /// </summary>
    [HttpPost("{adminId:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(
        Guid companyId,
        Guid adminId,
        [FromBody] ResetPasswordRequest req,
        CancellationToken ct = default)
    {
        if (!await _db.Companies.AnyAsync(c => c.Id == companyId && !c.IsDeleted, ct))
            return NotFound();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == adminId && u.CompanyId == companyId, ct);

        if (user is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "NewPassword deve ter ao menos 6 caracteres." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(User, GetIp(), "admin_user.reset_password", "admin_user",
            adminId.ToString(), user.Username, null, ct);

        return NoContent();
    }

    // ── Helpers ────────────────────────────────────────────────

    private string GetIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static AdminUserDto MapUser(AdminUser u) => new(
        u.Id, u.CompanyId, u.Username, u.Email,
        u.Role, u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc
    );
}
