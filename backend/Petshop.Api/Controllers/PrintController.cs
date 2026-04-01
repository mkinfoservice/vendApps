using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Services.Print;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/print")]
[Authorize(Roles = "admin,gerente,atendente")]
public class PrintController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PrintService _print;

    public PrintController(AppDbContext db, PrintService print)
    {
        _db = db;
        _print = print;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/print/jobs ─────────────────────────────────────────────────
    /// <summary>
    /// Retorna os últimos N jobs de impressão (pendentes + impressos) para a UI de fila.
    /// </summary>
    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs([FromQuery] int limit = 60, CancellationToken ct = default)
    {
        var jobs = await _db.PrintJobs
            .AsNoTracking()
            .Where(j => j.CompanyId == CompanyId)
            .OrderByDescending(j => j.CreatedAtUtc)
            .Take(limit)
            .Select(j => new
            {
                j.Id,
                j.OrderId,
                j.PublicId,
                j.IsPrinted,
                j.CreatedAtUtc,
                j.PrintedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(jobs);
    }

    // ── GET /admin/print/pending ──────────────────────────────────────────────
    /// <summary>
    /// Retorna os jobs de impressão ainda não impressos da empresa.
    /// Chamado pelo painel ao (re)conectar para replay da fila.
    /// </summary>
    [HttpGet("pending")]
    public async Task<IActionResult> Pending(CancellationToken ct = default)
    {
        var jobs = await _db.PrintJobs
            .AsNoTracking()
            .Where(j => j.CompanyId == CompanyId && !j.IsPrinted)
            .OrderBy(j => j.CreatedAtUtc)
            .Select(j => new
            {
                j.Id,
                j.PublicId,
                j.PrintPayloadJson,
                j.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(jobs);
    }

    // ── POST /admin/print/{jobId}/mark-printed ────────────────────────────────
    /// <summary>
    /// Marca um job como impresso. Chamado pelo frontend após window.print().
    /// </summary>
    [HttpPost("{jobId:guid}/mark-printed")]
    public async Task<IActionResult> MarkPrinted(Guid jobId, CancellationToken ct = default)
    {
        var job = await _db.PrintJobs
            .Include(j => j.Order)
            .FirstOrDefaultAsync(j => j.Id == jobId && j.CompanyId == CompanyId, ct);

        if (job is null) return NotFound();

        job.IsPrinted = true;
        job.PrintedAtUtc = DateTime.UtcNow;

        // Ao imprimir, avança automaticamente de RECEBIDO → EM_PREPARO
        if (job.Order is not null && job.Order.Status == OrderStatus.RECEBIDO)
            job.Order.Status = OrderStatus.EM_PREPARO;

        await _db.SaveChangesAsync(ct);

        return Ok(new { marked = true });
    }

    // ── POST /admin/orders/{orderId}/reprint ──────────────────────────────────
    /// <summary>
    /// Cria um novo job de impressão para um pedido já existente (reimpressão).
    /// </summary>
    [HttpPost("/admin/orders/{orderId:guid}/reprint")]
    public async Task<IActionResult> Reprint(Guid orderId, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.CompanyId == CompanyId, ct);

        if (order is null) return NotFound("Pedido não encontrado.");

        await _print.EnqueueAsync(order, ct);

        return Ok(new { queued = true });
    }
}
