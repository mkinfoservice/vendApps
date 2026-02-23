using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Sources;
using Petshop.Api.Data;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Services.Sync;
using System.Security.Claims;
using System.Text.Json;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/product-sources")]
[Authorize(Roles = "admin")]
public class AdminProductSourcesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ConnectorFactory _connectorFactory;
    private readonly DbSchemaDiscoveryService _schemaService;

    public AdminProductSourcesController(
        AppDbContext db,
        ConnectorFactory connectorFactory,
        DbSchemaDiscoveryService schemaService)
    {
        _db = db;
        _connectorFactory = connectorFactory;
        _schemaService = schemaService;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var sources = await _db.ExternalSources
            .AsNoTracking()
            .Where(s => s.CompanyId == CompanyId)
            .OrderBy(s => s.Name)
            .Select(s => new SourceListItem(
                s.Id, s.Name, s.SourceType, s.ConnectorType, s.IsActive,
                s.SyncMode, s.ScheduleCron, s.LastSyncAtUtc, s.CreatedAtUtc))
            .ToListAsync(ct);

        return Ok(new SourceListResponse(sources));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSourceRequest req, CancellationToken ct)
    {
        if (!await _db.Companies.AsNoTracking().AnyAsync(c => c.Id == CompanyId, ct))
            return BadRequest(new { error = "CompanyId do token nao foi encontrada no banco." });

        var source = new ExternalSource
        {
            CompanyId = CompanyId,
            Name = req.Name,
            SourceType = req.SourceType,
            ConnectorType = req.ConnectorType,
            ConnectionConfigEncrypted = req.ConnectionConfigJson,
            IsActive = req.IsActive,
            SyncMode = req.SyncMode,
            ScheduleCron = req.ScheduleCron,
            CreatedAtUtc = DateTime.UtcNow
        };

        try
        {
            _db.ExternalSources.Add(source);
            await _db.SaveChangesAsync(ct);
            return Ok(new { source.Id });
        }
        catch (DbUpdateException ex)
        {
            var detail = ex.InnerException?.Message ?? ex.Message;
            return BadRequest(new { error = "Falha ao salvar fonte de dados.", detail });
        }
    }
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSourceRequest req, CancellationToken ct)
    {
        var source = await _db.ExternalSources.FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound();

        if (req.Name != null) source.Name = req.Name;
        if (req.ConnectionConfigJson != null) source.ConnectionConfigEncrypted = req.ConnectionConfigJson;
        if (req.IsActive.HasValue) source.IsActive = req.IsActive.Value;
        if (req.SyncMode.HasValue) source.SyncMode = req.SyncMode.Value;
        if (req.ScheduleCron != null) source.ScheduleCron = req.ScheduleCron;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var source = await _db.ExternalSources.FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound();
        _db.ExternalSources.Remove(source);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/test-connection")]
    public async Task<IActionResult> TestConnection(Guid id, CancellationToken ct)
    {
        var source = await _db.ExternalSources.FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound();

        try
        {
            var connector = _connectorFactory.Create(source);
            var (success, message, sampleCount) = await connector.TestConnectionAsync(ct);
            return Ok(new TestConnectionResponse(success, message, sampleCount));
        }
        catch (Exception ex)
        {
            return Ok(new TestConnectionResponse(false, ex.Message, 0));
        }
    }

    [HttpGet("{id:guid}/db-schema/tables")]
    public async Task<IActionResult> GetDbTables(Guid id, CancellationToken ct)
    {
        var source = await _db.ExternalSources.FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound();

        var config = DeserializeConfig(source.ConnectionConfigEncrypted);
        if (config == null) return BadRequest("Configuração de conexão inválida.");

        try
        {
            var tables = await _schemaService.GetTablesAsync(config, ct);
            return Ok(new { tables });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}/db-schema/columns")]
    public async Task<IActionResult> GetDbColumns(Guid id, [FromQuery] string table, CancellationToken ct)
    {
        var source = await _db.ExternalSources.FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound();

        var config = DeserializeConfig(source.ConnectionConfigEncrypted);
        if (config == null) return BadRequest("Configuração de conexão inválida.");

        try
        {
            var columns = await _schemaService.GetColumnsAsync(config, table, ct);
            return Ok(new { columns });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private static DbConnectionConfig? DeserializeConfig(string? json) =>
        string.IsNullOrWhiteSpace(json) ? null :
        JsonSerializer.Deserialize<DbConnectionConfig>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
}
