using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Sync;
using Petshop.Api.Data;
using Petshop.Api.Entities.Sync;
using Petshop.Api.Services.Sync;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/products/sync")]
[Authorize(Roles = "admin")]
public class AdminProductSyncController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ProductSyncService _syncService;

    public AdminProductSyncController(AppDbContext db, ProductSyncService syncService)
    {
        _db = db;
        _syncService = syncService;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── POST /admin/products/sync (disparo manual) ────────────────────────────
    [HttpPost]
    public async Task<IActionResult> TriggerSync([FromBody] ManualSyncRequest req, CancellationToken ct)
    {
        var source = await _db.ExternalSources
            .FirstOrDefaultAsync(s => s.Id == req.SourceId && s.CompanyId == CompanyId, ct);
        if (source == null) return NotFound("Fonte não encontrada.");

        var job = await _syncService.RunAsync(
            CompanyId, req.SourceId, req.SyncType,
            req.UpdatedSince, req.BatchSize > 0 ? req.BatchSize : 100,
            SyncTriggeredBy.Manual, ct);

        return Ok(MapJob(job, source.Name));
    }

    // ── GET /admin/products/sync/jobs ─────────────────────────────────────────
    [HttpGet("jobs")]
    public async Task<IActionResult> ListJobs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var q = _db.ProductSyncJobs
            .AsNoTracking()
            .Include(j => j.ExternalSource)
            .Where(j => j.CompanyId == CompanyId)
            .OrderByDescending(j => j.StartedAtUtc);

        var total = await q.CountAsync(ct);
        var jobs = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        var items = jobs.Select(j => MapJob(j, j.ExternalSource.Name)).ToList();
        return Ok(new SyncJobListResponse(page, pageSize, total, items));
    }

    // ── GET /admin/products/sync/jobs/{jobId} ─────────────────────────────────
    [HttpGet("jobs/{jobId:guid}")]
    public async Task<IActionResult> GetJob(Guid jobId, CancellationToken ct)
    {
        var job = await _db.ProductSyncJobs
            .AsNoTracking()
            .Include(j => j.ExternalSource)
            .FirstOrDefaultAsync(j => j.Id == jobId && j.CompanyId == CompanyId, ct);

        if (job == null) return NotFound();
        return Ok(MapJob(job, job.ExternalSource.Name));
    }

    // ── GET /admin/products/sync/jobs/{jobId}/items ───────────────────────────
    [HttpGet("jobs/{jobId:guid}/items")]
    public async Task<IActionResult> GetJobItems(
        Guid jobId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        // Validate job belongs to company
        var jobExists = await _db.ProductSyncJobs
            .AnyAsync(j => j.Id == jobId && j.CompanyId == CompanyId, ct);
        if (!jobExists) return NotFound();

        var q = _db.ProductSyncItems
            .AsNoTracking()
            .Where(i => i.JobId == jobId);

        var total = await q.CountAsync(ct);
        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new SyncJobItemResponse(
                i.Id, i.ExternalId, i.InternalCode, i.Barcode,
                i.Action.ToString(), i.Reason, i.BeforeJson, i.AfterJson))
            .ToListAsync(ct);

        return Ok(new SyncJobItemsResponse(page, pageSize, total, items));
    }

    // ── POST /admin/products/sync/jobs/{jobId}/retry ──────────────────────────
    [HttpPost("jobs/{jobId:guid}/retry")]
    public async Task<IActionResult> RetryJob(Guid jobId, CancellationToken ct)
    {
        var original = await _db.ProductSyncJobs
            .Include(j => j.ExternalSource)
            .FirstOrDefaultAsync(j => j.Id == jobId && j.CompanyId == CompanyId, ct);

        if (original == null) return NotFound();
        if (original.Status != SyncJobStatus.Failed)
            return BadRequest("Somente jobs com status 'Failed' podem ser re-executados.");

        var job = await _syncService.RunAsync(
            CompanyId, original.ExternalSourceId,
            original.SyncType, original.FilterUpdatedSinceUtc,
            100, SyncTriggeredBy.Admin, ct);

        return Ok(MapJob(job, original.ExternalSource.Name));
    }

    private static SyncJobResponse MapJob(ProductSyncJob j, string sourceName) => new(
        j.Id, j.ExternalSourceId, sourceName,
        j.TriggeredBy.ToString(), j.SyncType.ToString(), j.Status.ToString(),
        j.TotalFetched, j.Inserted, j.Updated, j.Unchanged, j.Skipped, j.Conflicts,
        j.StartedAtUtc, j.FinishedAtUtc, j.ErrorMessage);
}
