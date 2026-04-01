using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("public/customers")]
public class PublicCustomersController : ControllerBase
{
    private readonly AppDbContext _db;

    public PublicCustomersController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Identifica (ou cria) um cliente pelo telefone, resolvendo a empresa pelo tableId.
    /// Chamado pela tela de mesa antes de montar o carrinho — permite mostrar pontos de fidelidade.
    /// </summary>
    [HttpPost("identify")]
    public async Task<IActionResult> Identify([FromBody] IdentifyCustomerRequest req, CancellationToken ct)
    {
        if (req.TableId == Guid.Empty)
            return BadRequest(new { error = "tableId obrigatório." });

        var phone = new string(req.Phone.Where(char.IsDigit).ToArray());
        if (phone.Length < 10)
            return BadRequest(new { error = "Telefone inválido." });

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Nome obrigatório." });

        // Resolve empresa pelo tableId
        var table = await _db.Set<Entities.StoreFront.Table>()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == req.TableId && t.IsActive, ct);

        if (table is null)
            return NotFound(new { error = "Mesa não encontrada." });

        var companyId = table.CompanyId;

        // Busca ou cria o cliente
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Phone == phone, ct);

        bool isNew = customer is null;

        if (isNew)
        {
            customer = new Customer
            {
                CompanyId = companyId,
                Name = req.Name.Trim(),
                Phone = phone,
                Cpf = string.IsNullOrWhiteSpace(req.Cpf)
                    ? null
                    : new string(req.Cpf.Where(char.IsDigit).ToArray()),
            };
            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new
        {
            customerId   = customer!.Id,
            name         = customer.Name,
            pointsBalance = customer.PointsBalance,
            isNew,
        });
    }
}

public sealed class IdentifyCustomerRequest
{
    public Guid   TableId { get; init; }
    public string Name    { get; init; } = "";
    public string Phone   { get; init; } = "";
    public string? Cpf   { get; init; }
}
