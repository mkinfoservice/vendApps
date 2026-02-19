using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Delivery;
using Petshop.Api.Data;
using Petshop.Api.Entities.Delivery;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("deliverers")]
[Authorize(Roles = "admin")]
public class DeliverersController : ControllerBase
{
    private readonly AppDbContext _db;

    public DeliverersController(AppDbContext db)
    {
        _db = db;
    }

    // GET /deliverers?isActive=true
    [HttpGet]
    public async Task<ActionResult<ListDeliverersResponse>> List(
        [FromQuery] bool? isActive = null,
        CancellationToken ct = default
    )
    {
        var q = _db.Deliverers.AsNoTracking().AsQueryable();

        if (isActive.HasValue)
            q = q.Where(d => d.IsActive == isActive.Value);

        var items = await q
            .OrderBy(d => d.Name)
            .Select(d => new DelivererListItem(
                d.Id,
                d.Name,
                d.Phone,
                d.Vehicle,
                d.IsActive,
                d.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new ListDeliverersResponse(items));
    }

    // POST /deliverers
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateDelivererRequest req,
        CancellationToken ct = default
    )
    {
        if (req is null) return BadRequest("Body inválido.");
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Phone)) return BadRequest("Phone é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Vehicle)) return BadRequest("Vehicle é obrigatório.");

        // PIN é obrigatório e deve ter 4-6 dígitos
        if (string.IsNullOrWhiteSpace(req.Pin))
            return BadRequest("Pin é obrigatório (4-6 dígitos).");

        var pinTrimmed = req.Pin.Trim();
        if (pinTrimmed.Length < 4 || pinTrimmed.Length > 6 || !pinTrimmed.All(char.IsDigit))
            return BadRequest("Pin deve conter 4 a 6 dígitos numéricos.");

        var d = new Deliverer
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            Phone = req.Phone.Trim(),
            Vehicle = req.Vehicle.Trim(),
            PinHash = BCrypt.Net.BCrypt.HashPassword(pinTrimmed),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Deliverers.Add(d);
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = d.Id });
    }

    // PATCH /deliverers/{id}/active?active=true
    [HttpPatch("{id:guid}/active")]
    public async Task<IActionResult> SetActive(
        [FromRoute] Guid id,
        [FromQuery] bool active,
        CancellationToken ct = default
    )
    {
        var d = await _db.Deliverers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound("Entregador não encontrado.");

        d.IsActive = active;
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = d.Id, isActive = d.IsActive });
    }

    // PATCH /deliverers/{id}/pin  (admin reseta PIN do entregador)
    [HttpPatch("{id:guid}/pin")]
    public async Task<IActionResult> ResetPin(
        [FromRoute] Guid id,
        [FromBody] ResetPinRequest req,
        CancellationToken ct = default
    )
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Pin))
            return BadRequest("Pin é obrigatório.");

        var pinTrimmed = req.Pin.Trim();
        if (pinTrimmed.Length < 4 || pinTrimmed.Length > 6 || !pinTrimmed.All(char.IsDigit))
            return BadRequest("Pin deve conter 4 a 6 dígitos numéricos.");

        var d = await _db.Deliverers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound("Entregador não encontrado.");

        d.PinHash = BCrypt.Net.BCrypt.HashPassword(pinTrimmed);
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = d.Id, message = "PIN atualizado com sucesso." });
    }
}
