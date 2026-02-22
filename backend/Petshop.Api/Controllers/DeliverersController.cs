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
    public async Task<ActionResult<IEnumerable<DelivererResponse>>> List(
        [FromQuery] bool? isActive = null,
        CancellationToken ct = default
    )
    {
        var q = _db.Deliverers.AsNoTracking().AsQueryable();

        if (isActive.HasValue)
            q = q.Where(d => d.IsActive == isActive.Value);

        var items = await q
            .OrderBy(d => d.Name)
            .Select(d => new DelivererResponse
            {
                Id = d.Id,
                Name = d.Name,
                Phone = d.Phone,
                Vehicle = d.Vehicle,
                IsActive = d.IsActive,
                CreatedAtUtc = d.CreatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // GET /deliverers/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DelivererResponse>> GetById(
        [FromRoute] Guid id,
        CancellationToken ct = default
    )
    {
        var d = await _db.Deliverers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (d is null) return NotFound("Entregador não encontrado.");

        return Ok(new DelivererResponse
        {
            Id = d.Id,
            Name = d.Name,
            Phone = d.Phone,
            Vehicle = d.Vehicle,
            IsActive = d.IsActive,
            CreatedAtUtc = d.CreatedAtUtc
        });
    }

    // POST /deliverers
    [HttpPost]
    public async Task<ActionResult<DelivererResponse>> Create(
        [FromBody] CreateDelivererRequest req,
        CancellationToken ct = default
    )
    {
        if (req is null) return BadRequest("Body inválido.");
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Phone)) return BadRequest("Phone é obrigatório.");

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
            Vehicle = req.Vehicle?.Trim() ?? "",
            PinHash = BCrypt.Net.BCrypt.HashPassword(pinTrimmed),
            IsActive = req.IsActive,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.Deliverers.Add(d);
        await _db.SaveChangesAsync(ct);

        return Ok(new DelivererResponse
        {
            Id = d.Id,
            Name = d.Name,
            Phone = d.Phone,
            Vehicle = d.Vehicle,
            IsActive = d.IsActive,
            CreatedAtUtc = d.CreatedAtUtc
        });
    }

    // PUT /deliverers/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DelivererResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] UpdateDelivererRequest req,
        CancellationToken ct = default
    )
    {
        if (req is null) return BadRequest("Body inválido.");
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Phone)) return BadRequest("Phone é obrigatório.");

        var d = await _db.Deliverers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound("Entregador não encontrado.");

        d.Name = req.Name.Trim();
        d.Phone = req.Phone.Trim();
        d.Vehicle = req.Vehicle?.Trim() ?? "";
        d.IsActive = req.IsActive;

        await _db.SaveChangesAsync(ct);

        return Ok(new DelivererResponse
        {
            Id = d.Id,
            Name = d.Name,
            Phone = d.Phone,
            Vehicle = d.Vehicle,
            IsActive = d.IsActive,
            CreatedAtUtc = d.CreatedAtUtc
        });
    }

    // DELETE /deliverers/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        CancellationToken ct = default
    )
    {
        var d = await _db.Deliverers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound("Entregador não encontrado.");

        _db.Deliverers.Remove(d);
        await _db.SaveChangesAsync(ct);

        return NoContent();
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
