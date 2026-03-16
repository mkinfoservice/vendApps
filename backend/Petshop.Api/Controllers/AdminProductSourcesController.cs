using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Sources;
using Petshop.Api.Data;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Services.Sync;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/product-sources")]
[Authorize(Roles = "admin,gerente")]
public class AdminProductSourcesController : ControllerBase
{
    private const long MaxDumpSizeBytes = 200L * 1024 * 1024; // 200 MB

    private readonly AppDbContext _db;
    private readonly ConnectorFactory _connectorFactory;
    private readonly DbSchemaDiscoveryService _schemaService;
    private readonly IWebHostEnvironment _env;

    public AdminProductSourcesController(
        AppDbContext db,
        ConnectorFactory connectorFactory,
        DbSchemaDiscoveryService schemaService,
        IWebHostEnvironment env)
    {
        _db = db;
        _connectorFactory = connectorFactory;
        _schemaService = schemaService;
        _env = env;
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

    [HttpPost("dump-upload")]
    [RequestSizeLimit(MaxDumpSizeBytes)]
    public async Task<IActionResult> UploadDump([FromForm] IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Arquivo .sql não enviado." });

        if (!file.FileName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Formato inválido. Envie um arquivo .sql." });

        if (file.Length > MaxDumpSizeBytes)
            return BadRequest(new { error = $"Arquivo muito grande. Limite: {MaxDumpSizeBytes / (1024 * 1024)} MB." });

        var uploadRoot = ResolveDumpUploadRoot();
        Directory.CreateDirectory(uploadRoot);

        var originalName = Path.GetFileNameWithoutExtension(file.FileName);
        var safeName = Regex.Replace(originalName, @"[^a-zA-Z0-9\-_]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(safeName))
            safeName = "dump";

        var finalName = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}-{safeName}.sql";
        var finalPath = Path.Combine(uploadRoot, finalName);

        await using (var output = new FileStream(finalPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        await using (var input = file.OpenReadStream())
        {
            await input.CopyToAsync(output, ct);
        }

        return Ok(new
        {
            filePath = finalPath,
            fileName = finalName,
            originalName = file.FileName,
            sizeBytes = file.Length
        });
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

    private string ResolveDumpUploadRoot()
    {
        var configured = Environment.GetEnvironmentVariable("SYNC_DUMP_UPLOAD_DIR");
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(configured);

        // Preferência: pasta local do app (útil para dev e containers com FS gravável)
        var appDataRoot = Path.Combine(_env.ContentRootPath, "App_Data", "sync-dumps", CompanyId.ToString("N"));
        try
        {
            Directory.CreateDirectory(appDataRoot);
            return appDataRoot;
        }
        catch
        {
            // Fallback para temp do sistema em ambientes restritos
            return Path.Combine(Path.GetTempPath(), "vendapps-sync-dumps", CompanyId.ToString("N"));
        }
    }
}
