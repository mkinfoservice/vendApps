using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Agenda;
using Petshop.Api.Entities.Financial;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/agenda")]
[Authorize(Roles = "admin,gerente,atendente")]
public class AgendaController : ControllerBase
{
    private readonly AppDbContext _db;
    public AgendaController(AppDbContext db) => _db = db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── Service Types ──────────────────────────────────────────────────────────

    [HttpGet("service-types")]
    public async Task<IActionResult> ListServiceTypes(CancellationToken ct)
    {
        var types = await _db.ServiceTypes.AsNoTracking()
            .Where(t => t.CompanyId == CompanyId)
            .OrderBy(t => t.Category)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);

        return Ok(types.Select(ToServiceTypeDto));
    }

    [HttpPost("service-types")]
    public async Task<IActionResult> CreateServiceType(
        [FromBody] UpsertServiceTypeRequest req, CancellationToken ct)
    {
        var st = new ServiceType
        {
            CompanyId         = CompanyId,
            Name              = req.Name.Trim(),
            DurationMinutes   = req.DurationMinutes,
            DefaultPriceCents = req.DefaultPriceCents,
            Category          = req.Category?.Trim(),
            IsActive          = true,
        };
        _db.ServiceTypes.Add(st);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(ListServiceTypes), null, ToServiceTypeDto(st));
    }

    [HttpPut("service-types/{id:guid}")]
    public async Task<IActionResult> UpdateServiceType(
        Guid id, [FromBody] UpsertServiceTypeRequest req, CancellationToken ct)
    {
        var st = await _db.ServiceTypes
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (st is null) return NotFound();

        st.Name              = req.Name.Trim();
        st.DurationMinutes   = req.DurationMinutes;
        st.DefaultPriceCents = req.DefaultPriceCents;
        st.Category          = req.Category?.Trim();
        st.IsActive          = req.IsActive;

        await _db.SaveChangesAsync(ct);
        return Ok(ToServiceTypeDto(st));
    }

    [HttpDelete("service-types/{id:guid}")]
    public async Task<IActionResult> DeleteServiceType(Guid id, CancellationToken ct)
    {
        var st = await _db.ServiceTypes
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (st is null) return NotFound();

        var hasAppts = await _db.ServiceAppointments
            .AnyAsync(a => a.ServiceTypeId == id, ct);
        if (hasAppts)
            return Conflict("Tipo possui agendamentos. Desative-o ao invés de excluir.");

        _db.ServiceTypes.Remove(st);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Appointments ───────────────────────────────────────────────────────────

    [HttpGet("appointments")]
    public async Task<IActionResult> ListAppointments(
        [FromQuery] string? from   = null,
        [FromQuery] string? to     = null,
        [FromQuery] string? status = null,
        CancellationToken   ct     = default)
    {
        var q = _db.ServiceAppointments.AsNoTracking()
            .Include(a => a.ServiceType)
            .Where(a => a.CompanyId == CompanyId);

        if (DateTime.TryParse(from + "T00:00:00", out var fromDt))
            q = q.Where(a => a.ScheduledAt >= fromDt);
        if (DateTime.TryParse(to + "T23:59:59", out var toDt))
            q = q.Where(a => a.ScheduledAt <= toDt);

        if (status is not null && Enum.TryParse<AppointmentStatus>(status, out var st))
            q = q.Where(a => a.Status == st);

        var items = await q.OrderBy(a => a.ScheduledAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpPost("appointments")]
    public async Task<IActionResult> CreateAppointment(
        [FromBody] UpsertAppointmentRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.ServiceTypeId, out var stId))
            return BadRequest("ServiceTypeId inválido.");
        if (!DateTime.TryParse(req.ScheduledAt, out var scheduledAt))
            return BadRequest("ScheduledAt inválido.");

        var serviceType = await _db.ServiceTypes
            .FirstOrDefaultAsync(t => t.Id == stId && t.CompanyId == CompanyId, ct);
        if (serviceType is null) return NotFound("Tipo de serviço não encontrado.");

        var appt = new ServiceAppointment
        {
            CompanyId     = CompanyId,
            ServiceTypeId = stId,
            ScheduledAt   = scheduledAt,
            PetName       = req.PetName.Trim(),
            PetBreed      = req.PetBreed?.Trim(),
            CustomerName  = req.CustomerName.Trim(),
            CustomerPhone = req.CustomerPhone?.Trim(),
            OperatorName  = req.OperatorName?.Trim(),
            PriceCents    = req.PriceCents,
            Notes         = req.Notes?.Trim(),
        };

        _db.ServiceAppointments.Add(appt);
        await _db.SaveChangesAsync(ct);

        appt.ServiceType = serviceType;
        return CreatedAtAction(nameof(ListAppointments), null, ToDto(appt));
    }

    [HttpPut("appointments/{id:guid}")]
    public async Task<IActionResult> UpdateAppointment(
        Guid id, [FromBody] UpsertAppointmentRequest req, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        if (!Guid.TryParse(req.ServiceTypeId, out var stId))
            return BadRequest("ServiceTypeId inválido.");
        if (!DateTime.TryParse(req.ScheduledAt, out var scheduledAt))
            return BadRequest("ScheduledAt inválido.");

        var serviceType = await _db.ServiceTypes
            .FirstOrDefaultAsync(t => t.Id == stId && t.CompanyId == CompanyId, ct);
        if (serviceType is null) return NotFound("Tipo de serviço não encontrado.");

        appt.ServiceTypeId = stId;
        appt.ServiceType   = serviceType;
        appt.ScheduledAt   = scheduledAt;
        appt.PetName       = req.PetName.Trim();
        appt.PetBreed      = req.PetBreed?.Trim();
        appt.CustomerName  = req.CustomerName.Trim();
        appt.CustomerPhone = req.CustomerPhone?.Trim();
        appt.OperatorName  = req.OperatorName?.Trim();
        appt.PriceCents    = req.PriceCents;
        appt.Notes         = req.Notes?.Trim();
        appt.UpdatedAtUtc  = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpPatch("appointments/{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        appt.Status       = AppointmentStatus.CheckedIn;
        appt.CheckedInAt  = DateTime.UtcNow;
        appt.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpPatch("appointments/{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        appt.Status       = AppointmentStatus.InProgress;
        appt.StartedAt    = DateTime.UtcNow;
        appt.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpPatch("appointments/{id:guid}/done")]
    public async Task<IActionResult> Done(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        if (appt.Status == AppointmentStatus.Done) return Ok(ToDto(appt));

        appt.Status       = AppointmentStatus.Done;
        appt.DoneAt       = DateTime.UtcNow;
        appt.UpdatedAtUtc = DateTime.UtcNow;

        // Gera lançamento financeiro automaticamente
        if (appt.PriceCents > 0 && appt.FinancialEntryId is null)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var entry = new FinancialEntry
            {
                CompanyId     = CompanyId,
                Type          = FinancialEntryType.Receita,
                Title         = $"{appt.ServiceType.Name} — {appt.PetName} ({appt.CustomerName})",
                AmountCents   = appt.PriceCents,
                DueDate       = today,
                IsPaid        = true,
                PaidDate      = today,
                Category      = appt.ServiceType.Category ?? "Serviços",
                Notes         = appt.Notes,
                ReferenceType = "ServiceAppointment",
                ReferenceId   = appt.Id,
            };
            _db.FinancialEntries.Add(entry);
            appt.FinancialEntryId = entry.Id;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpPatch("appointments/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        appt.Status       = AppointmentStatus.Cancelled;
        appt.CancelledAt  = DateTime.UtcNow;
        appt.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpPatch("appointments/{id:guid}/noshow")]
    public async Task<IActionResult> NoShow(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .Include(a => a.ServiceType)
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        appt.Status       = AppointmentStatus.NoShow;
        appt.CancelledAt  = DateTime.UtcNow;
        appt.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(appt));
    }

    [HttpDelete("appointments/{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id, CancellationToken ct)
    {
        var appt = await _db.ServiceAppointments
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (appt is null) return NotFound();

        _db.ServiceAppointments.Remove(appt);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static object ToServiceTypeDto(ServiceType t) => new
    {
        t.Id,
        t.Name,
        t.DurationMinutes,
        t.DefaultPriceCents,
        t.Category,
        t.IsActive,
    };

    private static object ToDto(ServiceAppointment a) => new
    {
        a.Id,
        a.ServiceTypeId,
        ServiceTypeName     = a.ServiceType.Name,
        ServiceTypeCategory = a.ServiceType.Category,
        ScheduledAt         = a.ScheduledAt.ToString("yyyy-MM-ddTHH:mm:ss"),
        a.PetName,
        a.PetBreed,
        a.CustomerName,
        a.CustomerPhone,
        a.OperatorName,
        Status              = a.Status.ToString(),
        a.PriceCents,
        a.Notes,
        CheckedInAt         = a.CheckedInAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
        StartedAt           = a.StartedAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
        DoneAt              = a.DoneAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
        CancelledAt         = a.CancelledAt?.ToString("yyyy-MM-ddTHH:mm:ss"),
        a.FinancialEntryId,
        a.CreatedAtUtc,
    };
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record UpsertServiceTypeRequest(
    [Required, MaxLength(100)] string Name,
    int     DurationMinutes   = 60,
    int     DefaultPriceCents = 0,
    string? Category          = null,
    bool    IsActive          = true
);

public record UpsertAppointmentRequest(
    [Required] string ServiceTypeId,
    [Required] string ScheduledAt,           // "YYYY-MM-DDTHH:mm:ss"
    [Required, MaxLength(80)]  string PetName,
    string? PetBreed,
    [Required, MaxLength(120)] string CustomerName,
    string? CustomerPhone,
    string? OperatorName,
    int     PriceCents,
    string? Notes
);
