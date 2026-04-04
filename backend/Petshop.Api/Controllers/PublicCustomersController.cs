using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Services.Customers;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("public/customers")]
public class PublicCustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CpfProtectionService _cpfSvc;

    public PublicCustomersController(AppDbContext db, CpfProtectionService cpfSvc)
    {
        _db = db;
        _cpfSvc = cpfSvc;
    }

    /// <summary>
    /// Identifica (ou cria) um cliente pelo telefone, resolvendo a empresa pelo tableId.
    /// Chamado pela tela de mesa antes de montar o carrinho � permite mostrar pontos de fidelidade.
    /// </summary>
    [HttpPost("identify")]
    [EnableRateLimiting("public_api")]
    public async Task<IActionResult> Identify([FromBody] IdentifyCustomerRequest req, CancellationToken ct)
    {
        if (req.TableId == Guid.Empty)
            return BadRequest(new { error = "tableId obrigat�rio." });

        var phone = new string(req.Phone.Where(char.IsDigit).ToArray());
        if (phone.Length < 10)
            return BadRequest(new { error = "Telefone inv�lido." });

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Nome obrigat�rio." });

        var cpf = CpfValidator.Normalize(req.Cpf);
        if (!string.IsNullOrWhiteSpace(cpf) && !CpfValidator.IsValid(cpf))
            return BadRequest(new { error = "CPF inv�lido." });

        // Resolve empresa pelo tableId
        var table = await _db.Set<Entities.StoreFront.Table>()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == req.TableId && t.IsActive, ct);

        if (table is null)
            return NotFound(new { error = "Mesa n�o encontrada." });

        var companyId = table.CompanyId;

        // Busca ou cria o cliente
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Phone == phone, ct);

        var isNew = customer is null;

        if (isNew)
        {
            customer = new Customer
            {
                CompanyId = companyId,
                Name = req.Name.Trim(),
                Phone = phone,
                Cpf     = _cpfSvc.Protect(cpf),
                CpfHash = cpf != null ? _cpfSvc.Hash(cpf) : null,
            };
            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new
        {
            customerId = customer!.Id,
            name = customer.Name,
            pointsBalance = customer.PointsBalance,
            isNew,
        });
    }
}

public sealed class IdentifyCustomerRequest
{
    public Guid TableId { get; init; }
    public string Name { get; init; } = "";
    public string Phone { get; init; } = "";
    public string? Cpf { get; init; }
}
