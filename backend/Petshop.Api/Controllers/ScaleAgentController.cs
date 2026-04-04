using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Petshop.Api.Contracts.Admin.Scale;
using Petshop.Api.Data;
using Petshop.Api.Entities.Scale;
using Petshop.Api.Services.Scale.Jobs;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Petshop.Api.Controllers;

// ── Admin endpoints (/admin/scale/agents) ─────────────────────────────────────

[ApiController]
[Route("admin/scale/agents")]
[Authorize(Roles = "admin,gerente")]
public class ScaleAgentController : ControllerBase
{
    private readonly AppDbContext    _db;
    private readonly IConfiguration  _config;
    private readonly IBackgroundJobClient _jobs;

    public ScaleAgentController(AppDbContext db, IConfiguration config, IBackgroundJobClient jobs)
    {
        _db     = db;
        _config = config;
        _jobs   = jobs;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // GET /admin/scale/agents
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await _db.ScaleAgents
            .Where(a => a.CompanyId == CompanyId)
            .OrderBy(a => a.MachineName)
            .Select(a => new ScaleAgentListItem(
                a.Id,
                a.MachineName,
                a.IsOnline,
                a.LastSeenUtc,
                a.Devices.Count(d => d.IsActive),
                a.Notes))
            .ToListAsync(ct);

        return Ok(items);
    }

    // GET /admin/scale/agents/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var agent = await _db.ScaleAgents
            .Include(a => a.Devices)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);

        if (agent == null) return NotFound();

        return Ok(new ScaleAgentDetail(
            agent.Id,
            agent.MachineName,
            agent.AgentKey,
            agent.IsOnline,
            agent.LastSeenUtc,
            agent.Notes,
            agent.Devices.Select(d => new ScaleDeviceDto(
                d.Id, d.Name, d.ScaleModel.ToString(),
                d.PortName, d.BaudRate, d.IsActive, d.LastSyncUtc)).ToList()));
    }

    // POST /admin/scale/agents
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateScaleAgentRequest req, CancellationToken ct)
    {
        var agent = new ScaleAgent
        {
            CompanyId   = CompanyId,
            MachineName = req.MachineName.Trim(),
            AgentKey    = Guid.NewGuid().ToString("N"),   // segredo compartilhado
            Notes       = req.Notes?.Trim(),
        };

        _db.ScaleAgents.Add(agent);
        await _db.SaveChangesAsync(ct);

        return Ok(new { agent.Id, agent.AgentKey });
    }

    // PUT /admin/scale/agents/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateScaleAgentRequest req, CancellationToken ct)
    {
        var agent = await _db.ScaleAgents
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);

        if (agent == null) return NotFound();

        agent.MachineName = req.MachineName.Trim();
        agent.Notes       = req.Notes?.Trim();
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // DELETE /admin/scale/agents/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var agent = await _db.ScaleAgents
            .Include(a => a.Devices)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);

        if (agent == null) return NotFound();

        _db.ScaleAgents.Remove(agent);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── Devices ───────────────────────────────────────────────────────────────

    // POST /admin/scale/agents/{agentId}/devices
    [HttpPost("{agentId:guid}/devices")]
    public async Task<IActionResult> AddDevice(Guid agentId, [FromBody] CreateScaleDeviceRequest req, CancellationToken ct)
    {
        var agent = await _db.ScaleAgents
            .FirstOrDefaultAsync(a => a.Id == agentId && a.CompanyId == CompanyId, ct);

        if (agent == null) return NotFound();

        if (!Enum.TryParse<ScaleModel>(req.ScaleModel, out var model))
            return BadRequest(new { error = "ScaleModel inválido." });

        var device = new ScaleDevice
        {
            AgentId    = agentId,
            CompanyId  = CompanyId,
            Name       = req.Name.Trim(),
            ScaleModel = model,
            PortName   = req.PortName.Trim(),
            BaudRate   = req.BaudRate,
        };

        _db.ScaleDevices.Add(device);
        await _db.SaveChangesAsync(ct);

        return Ok(new { device.Id });
    }

    // PUT /admin/scale/agents/{agentId}/devices/{deviceId}
    [HttpPut("{agentId:guid}/devices/{deviceId:guid}")]
    public async Task<IActionResult> UpdateDevice(Guid agentId, Guid deviceId,
        [FromBody] UpdateScaleDeviceRequest req, CancellationToken ct)
    {
        var device = await _db.ScaleDevices
            .FirstOrDefaultAsync(d => d.Id == deviceId && d.AgentId == agentId
                                   && d.CompanyId == CompanyId, ct);

        if (device == null) return NotFound();

        if (!Enum.TryParse<ScaleModel>(req.ScaleModel, out var model))
            return BadRequest(new { error = "ScaleModel inválido." });

        device.Name       = req.Name.Trim();
        device.ScaleModel = model;
        device.PortName   = req.PortName.Trim();
        device.BaudRate   = req.BaudRate;
        device.IsActive   = req.IsActive;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // DELETE /admin/scale/agents/{agentId}/devices/{deviceId}
    [HttpDelete("{agentId:guid}/devices/{deviceId:guid}")]
    public async Task<IActionResult> DeleteDevice(Guid agentId, Guid deviceId, CancellationToken ct)
    {
        var device = await _db.ScaleDevices
            .FirstOrDefaultAsync(d => d.Id == deviceId && d.AgentId == agentId
                                   && d.CompanyId == CompanyId, ct);

        if (device == null) return NotFound();

        _db.ScaleDevices.Remove(device);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // POST /admin/scale/agents/{agentId}/devices/{deviceId}/sync
    [HttpPost("{agentId:guid}/devices/{deviceId:guid}/sync")]
    public async Task<IActionResult> TriggerSync(Guid agentId, Guid deviceId, CancellationToken ct)
    {
        var device = await _db.ScaleDevices
            .Include(d => d.Agent)
            .FirstOrDefaultAsync(d => d.Id == deviceId && d.AgentId == agentId
                                   && d.CompanyId == CompanyId, ct);

        if (device == null) return NotFound();
        if (!device.IsActive) return BadRequest(new { error = "Dispositivo inativo." });
        if (!device.Agent.IsOnline) return BadRequest(new { error = "Agente offline." });

        _jobs.Enqueue<ScaleProductSyncJob>(j => j.RunAsync(deviceId, CancellationToken.None));

        return Accepted(new { message = "Sincronização enfileirada." });
    }

    // ── JWT regeneration ──────────────────────────────────────────────────────

    // POST /admin/scale/agents/{id}/regenerate-key
    [HttpPost("{id:guid}/regenerate-key")]
    public async Task<IActionResult> RegenerateKey(Guid id, CancellationToken ct)
    {
        var agent = await _db.ScaleAgents
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);

        if (agent == null) return NotFound();

        agent.AgentKey = Guid.NewGuid().ToString("N");
        await _db.SaveChangesAsync(ct);

        return Ok(new { agent.AgentKey });
    }
}

// ── Agent auth endpoint (/scale/agent/auth) ───────────────────────────────────

[ApiController]
[Route("scale/agent")]
[AllowAnonymous]
public class ScaleAgentAuthController : ControllerBase
{
    private readonly AppDbContext   _db;
    private readonly IConfiguration _config;

    public ScaleAgentAuthController(AppDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    /// <summary>
    /// Troca a AgentKey por um JWT com role "scale_agent".
    /// O serviço Windows usa esse token para conectar ao SignalR hub.
    /// </summary>
    [HttpPost("auth")]
    public async Task<IActionResult> Auth([FromBody] AgentAuthRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.AgentKey))
            return BadRequest(new { error = "AgentKey obrigatória." });

        var agent = await _db.ScaleAgents
            .FirstOrDefaultAsync(a => a.AgentKey == req.AgentKey, ct);

        if (agent == null)
            return Unauthorized(new { error = "AgentKey inválida." });

        var jwt      = _config.GetSection("Jwt");
        var keyBytes = Encoding.UTF8.GetBytes(jwt["Key"]!);
        var creds    = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.Role, "scale_agent"),
            new Claim("agentId",   agent.Id.ToString()),
            new Claim("companyId", agent.CompanyId.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer:   jwt["Issuer"],
            audience: jwt["Audience"],
            claims:   claims,
            expires:  DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);

        return Ok(new AgentAuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            agent.Id,
            agent.CompanyId));
    }
}
