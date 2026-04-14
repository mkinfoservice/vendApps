using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Dav;
using Petshop.Api.Entities.Pdv;
using Hangfire;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Services.Fiscal;
using Petshop.Api.Services.Fiscal.Jobs;
using Petshop.Api.Services.WhatsApp;
using Petshop.Api.Services.Scale;
using Petshop.Api.Services.Customers;
using Petshop.Api.Services.Stock;
using Petshop.Api.Entities;
using Petshop.Api.Services;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// PDV â€" sessÃ£o de caixa e ciclo de venda.
/// Todos os endpoints exigem JWT de admin/gerente/atendente.
/// </summary>
[ApiController]
[Route("pdv")]
[Authorize(Roles = "admin,gerente,atendente")]
public class PdvController : ControllerBase
{
    private readonly AppDbContext                _db;
    private readonly ScaleBarcodeParser          _scale;
    private readonly FiscalDecisionService       _fiscal;
    private readonly IBackgroundJobClient        _jobs;
    private readonly StockService                _stock;
    private readonly LoyaltyService              _loyalty;
    private readonly CpfProtectionService        _cpfProtection;
    private readonly ILogger<PdvController>      _logger;

    public PdvController(AppDbContext db, ScaleBarcodeParser scale, FiscalDecisionService fiscal, IBackgroundJobClient jobs, StockService stock, LoyaltyService loyalty, CpfProtectionService cpfProtection, ILogger<PdvController> logger)
    {
        _db      = db;
        _scale   = scale;
        _fiscal  = fiscal;
        _jobs    = jobs;
        _stock   = stock;
        _loyalty = loyalty;
        _cpfProtection = cpfProtection;
        _logger  = logger;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);
    private Guid UserId
    {
        get
        {
            // Alguns tokens (ex.: admin estatico) usam sub=username e nao um GUID.
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? User.FindFirstValue("userId")
                   ?? User.FindFirstValue("sub");

            return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
        }
    }
    private string UserName => User.FindFirstValue(ClaimTypes.Name) ?? "Operador";

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // SESSÃƒO DE CAIXA
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // â"€â"€ GET /pdv/session/current â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>Retorna a sessÃ£o aberta da empresa (uma por vez), ou null.</summary>
    [HttpGet("session/current")]
    public async Task<IActionResult> GetCurrentSession(CancellationToken ct)
    {
        var session = await _db.CashSessions
            .AsNoTracking()
            .Include(s => s.CashRegister)
            .Where(s => s.CompanyId == CompanyId && s.Status == CashSessionStatus.Open)
            .OrderByDescending(s => s.OpenedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (session is null) return Ok(null);

        return Ok(MapSession(session));
    }

    // â"€â"€ POST /pdv/session/open â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("session/open")]
    public async Task<IActionResult> OpenSession(
        [FromBody] OpenSessionRequest req,
        CancellationToken ct)
    {
        var register = await _db.CashRegisters
            .FirstOrDefaultAsync(r => r.Id == req.CashRegisterId &&
                                      r.CompanyId == CompanyId && r.IsActive, ct);

        if (register is null) return BadRequest("Terminal nÃ£o encontrado ou inativo.");

        var existingOpen = await _db.CashSessions
            .AnyAsync(s => s.CashRegisterId == req.CashRegisterId &&
                           s.Status == CashSessionStatus.Open, ct);

        if (existingOpen)
            return Conflict("Este terminal jÃ¡ possui uma sessÃ£o aberta.");

        var session = new CashSession
        {
            CompanyId           = CompanyId,
            CashRegisterId      = req.CashRegisterId,
            OpenedByUserId      = UserId,
            OpenedByUserName    = UserName,
            OpeningBalanceCents = req.OpeningBalanceCents,
            Notes               = req.Notes,
            Status              = CashSessionStatus.Open
        };

        _db.CashSessions.Add(session);
        await _db.SaveChangesAsync(ct);

        return Ok(new { session.Id, session.OpenedAtUtc, RegisterName = register.Name });
    }

    // â"€â"€ POST /pdv/session/{sessionId}/close â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("session/{sessionId:guid}/close")]
    public async Task<IActionResult> CloseSession(
        Guid sessionId,
        [FromBody] CloseSessionRequest req,
        CancellationToken ct)
    {
        var session = await _db.CashSessions
            .Include(s => s.Sales)
            .FirstOrDefaultAsync(s => s.Id == sessionId &&
                                      s.CompanyId == CompanyId &&
                                      s.Status == CashSessionStatus.Open, ct);

        if (session is null) return NotFound("SessÃ£o nÃ£o encontrada ou jÃ¡ fechada.");

        // NÃ£o permite fechar com vendas abertas
        var openSalesCount = session.Sales.Count(s => s.Status == SaleOrderStatus.Open);
        if (openSalesCount > 0)
            return Conflict($"Existem {openSalesCount} venda(s) em aberto. Finalize ou cancele antes de fechar o caixa.");

        // Calcular totalizadores
        var completedSales = session.Sales.Where(s => s.Status == SaleOrderStatus.Completed).ToList();

        session.Status                  = CashSessionStatus.Closed;
        session.ClosedByUserId          = UserId;
        session.ClosedByUserName        = UserName;
        session.ClosingBalanceCents     = req.ClosingBalanceCents;
        session.TotalSalesCount         = completedSales.Count;
        session.TotalSalesCents         = completedSales.Sum(s => s.TotalCents);
        session.PermanentContingencyCount = completedSales
            .Count(s => s.FiscalDecision == "PermanentContingency");
        session.Notes                   = req.Notes ?? session.Notes;
        session.ClosedAtUtc             = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            session.Id,
            session.ClosedAtUtc,
            session.TotalSalesCount,
            TotalSalesCents          = session.TotalSalesCents,
            session.PermanentContingencyCount,
            OpeningBalanceCents      = session.OpeningBalanceCents,
            ClosingBalanceCents      = session.ClosingBalanceCents
        });
    }

    // â"€â"€ GET /pdv/session/{sessionId}/report â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet("session/{sessionId:guid}/report")]
    public async Task<IActionResult> SessionReport(Guid sessionId, CancellationToken ct)
    {
        var session = await _db.CashSessions
            .AsNoTracking()
            .Include(s => s.CashRegister)
            .Include(s => s.Sales)
                .ThenInclude(o => o.Payments)
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.CompanyId == CompanyId, ct);

        if (session is null) return NotFound("SessÃ£o nÃ£o encontrada.");

        var completedSales = session.Sales.Where(s => s.Status == SaleOrderStatus.Completed).ToList();

        var byPaymentMethod = completedSales
            .SelectMany(s => s.Payments)
            .GroupBy(p => p.PaymentMethod)
            .Select(g => new { PaymentMethod = g.Key, TotalCents = g.Sum(p => p.AmountCents) })
            .OrderByDescending(x => x.TotalCents)
            .ToList();

        var movements = session.Movements
            .OrderBy(m => m.CreatedAtUtc)
            .Select(m => new {
                m.Id, Type = m.Type.ToString(), m.AmountCents,
                m.Description, m.OperatorName, m.CreatedAtUtc
            }).ToList();

        var totalSangriaCents    = session.Movements.Where(m => m.Type == CashMovementType.Sangria).Sum(m => m.AmountCents);
        var totalSuprimentoCents = session.Movements.Where(m => m.Type == CashMovementType.Suprimento).Sum(m => m.AmountCents);
        var cashSalesCents       = completedSales.SelectMany(s => s.Payments)
                                       .Where(p => p.PaymentMethod == "DINHEIRO")
                                       .Sum(p => p.AmountCents - p.ChangeCents);
        var expectedCashCents    = session.OpeningBalanceCents + cashSalesCents + totalSuprimentoCents - totalSangriaCents;

        return Ok(new
        {
            session.Id,
            RegisterName              = session.CashRegister.Name,
            session.OpenedByUserName,
            session.ClosedByUserName,
            Status                    = session.Status.ToString(),
            session.OpeningBalanceCents,
            session.ClosingBalanceCents,
            session.OpenedAtUtc,
            session.ClosedAtUtc,
            TotalSalesCount           = completedSales.Count,
            TotalSalesCents           = completedSales.Sum(s => s.TotalCents),
            CancelledSalesCount       = session.Sales.Count(s => s.Status == SaleOrderStatus.Cancelled),
            PermanentContingencyCount = completedSales.Count(s => s.FiscalDecision == "PermanentContingency"),
            ByPaymentMethod           = byPaymentMethod,
            Movements                 = movements,
            TotalSangriaCents         = totalSangriaCents,
            TotalSuprimentoCents      = totalSuprimentoCents,
            ExpectedCashCents         = expectedCashCents,
        });
    }

    // â"€â"€ GET /pdv/session/{sessionId}/movements â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet("session/{sessionId:guid}/movements")]
    public async Task<IActionResult> ListMovements(Guid sessionId, CancellationToken ct)
    {
        var exists = await _db.CashSessions
            .AnyAsync(s => s.Id == sessionId && s.CompanyId == CompanyId, ct);
        if (!exists) return NotFound("SessÃ£o nÃ£o encontrada.");

        var movements = await _db.CashMovements
            .AsNoTracking()
            .Where(m => m.CashSessionId == sessionId)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Select(m => new {
                m.Id, Type = m.Type.ToString(), m.AmountCents,
                m.Description, m.OperatorName, m.CreatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(movements);
    }

    // â"€â"€ POST /pdv/session/{sessionId}/movements â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("session/{sessionId:guid}/movements")]
    public async Task<IActionResult> AddMovement(
        Guid sessionId,
        [FromBody] AddMovementRequest req,
        CancellationToken ct)
    {
        var session = await _db.CashSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId &&
                                      s.CompanyId == CompanyId &&
                                      s.Status == CashSessionStatus.Open, ct);
        if (session is null) return NotFound("SessÃ£o nÃ£o encontrada ou jÃ¡ fechada.");

        if (req.AmountCents <= 0) return BadRequest("Valor deve ser positivo.");

        var movement = new CashMovement
        {
            CompanyId     = CompanyId,
            CashSessionId = sessionId,
            Type          = Enum.Parse<CashMovementType>(req.Type),
            AmountCents   = req.AmountCents,
            Description   = req.Description?.Trim() ?? "",
            OperatorName  = UserName,
        };

        _db.CashMovements.Add(movement);
        await _db.SaveChangesAsync(ct);

        return Ok(new {
            movement.Id, Type = movement.Type.ToString(), movement.AmountCents,
            movement.Description, movement.OperatorName, movement.CreatedAtUtc
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // VENDA
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // â"€â"€ POST /pdv/sale â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("sale")]
    public async Task<IActionResult> CreateSale(
        [FromBody] CreateSaleRequest req,
        CancellationToken ct)
    {
        var session = await _db.CashSessions
            .Include(s => s.CashRegister)
            .FirstOrDefaultAsync(s => s.Id == req.CashSessionId &&
                                      s.CompanyId == CompanyId &&
                                      s.Status == CashSessionStatus.Open, ct);

        if (session is null)
            return BadRequest("SessÃ£o nÃ£o encontrada ou jÃ¡ fechada.");

        Entities.Customer? customer = null;
        if (req.CustomerId.HasValue)
        {
            customer = await _db.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == req.CustomerId.Value && c.CompanyId == CompanyId, ct);

            if (customer is null)
                return BadRequest("Cliente informado nao encontrado.");
        }

        var sale = new SaleOrder
        {
            CompanyId                  = CompanyId,
            PublicId                   = $"PDV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(0, 999999):D6}",
            CashSessionId              = session.Id,
            CashRegisterId             = session.CashRegisterId,
            CashRegisterNameSnapshot   = session.CashRegister?.Name,
            OperatorUserId             = UserId == Guid.Empty ? null : UserId,
            OperatorName               = UserName,
            CustomerId                 = customer?.Id,
            CustomerName               = req.CustomerName ?? customer?.Name ?? "",
            CustomerPhone              = req.CustomerPhone ?? customer?.Phone,
            Status                     = SaleOrderStatus.Open
        };

        // Importar de DAV se informado
        if (req.SalesQuoteId.HasValue)
        {
            var dav = await _db.SalesQuotes
                .Include(q => q.Items)
                .FirstOrDefaultAsync(q => q.Id == req.SalesQuoteId.Value &&
                                          q.CompanyId == CompanyId &&
                                          q.Status != SalesQuoteStatus.Converted &&
                                          q.Status != SalesQuoteStatus.Cancelled, ct);

            if (dav is null)
                return BadRequest("DAV nÃ£o encontrado ou nÃ£o pode ser importado.");

            sale.SalesQuoteId  = dav.Id;
            sale.CustomerName  = string.IsNullOrWhiteSpace(req.CustomerName)
                ? dav.CustomerName : req.CustomerName;
            sale.CustomerPhone = req.CustomerPhone ?? dav.CustomerPhone;

            foreach (var item in dav.Items)
            {
                sale.Items.Add(new SaleOrderItem
                {
                    ProductId              = item.ProductId,
                    ProductNameSnapshot    = item.ProductNameSnapshot,
                    ProductBarcodeSnapshot = item.ProductBarcodeSnapshot,
                    Qty                    = item.Qty,
                    UnitPriceCentsSnapshot = item.UnitPriceCentsSnapshot,
                    TotalCents             = item.TotalCents,
                    IsSoldByWeight         = item.IsSoldByWeight,
                    WeightKg               = item.WeightKg
                });
            }

            RecalcSaleTotals(sale);
        }

        _db.SaleOrders.Add(sale);
        await _db.SaveChangesAsync(ct);

        return Ok(new { sale.Id, sale.PublicId });
    }

    // â"€â"€ GET /pdv/sale/{id} â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet("sale/{id:guid}")]
    public async Task<IActionResult> GetSale(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Addons)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada.");

        Petshop.Api.Entities.Fiscal.FiscalDocument? fiscal = null;
        if (sale.FiscalDocumentId.HasValue)
            fiscal = await _db.FiscalDocuments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == sale.FiscalDocumentId.Value, ct);

        return Ok(MapSale(sale, fiscal));
    }

    // -- GET /pdv/sale/{id}/fiscal -----------------------------------------------
    /// <summary>
    /// Retorna os dados fiscais completos vinculados a uma venda PDV,
    /// incluindo o XmlContent para download/auditoria.
    /// Restrito a admin e gerente.
    /// </summary>
    [HttpGet("sale/{id:guid}/fiscal")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> GetSaleFiscal(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Select(o => new { o.Id, o.CompanyId, o.PublicId, o.FiscalDocumentId,
                               o.TotalCents, o.CreatedAtUtc, o.CompletedAtUtc,
                               Status = o.Status.ToString() })
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);

        if (sale is null) return NotFound("Venda nao encontrada.");

        if (!sale.FiscalDocumentId.HasValue)
            return Ok(new { saleId = id, salePublicId = sale.PublicId, fiscal = (object?)null,
                            message = "Esta venda nao possui documento fiscal associado." });

        var fiscal = await _db.FiscalDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == sale.FiscalDocumentId.Value, ct);

        if (fiscal is null)
            return NotFound("Documento fiscal nao encontrado.");

        return Ok(new
        {
            SaleId          = sale.Id,
            SalePublicId    = sale.PublicId,
            SaleTotalCents  = sale.TotalCents,
            SaleStatus      = sale.Status,
            Fiscal = new
            {
                fiscal.Id,
                fiscal.Number,
                fiscal.Serie,
                fiscal.AccessKey,
                FiscalStatus    = fiscal.FiscalStatus.ToString(),
                ContingencyType = fiscal.ContingencyType.ToString(),
                IsContingency   = fiscal.ContingencyType != Petshop.Api.Entities.Fiscal.ContingencyType.None,
                fiscal.AuthorizationCode,
                fiscal.AuthorizationDateTimeUtc,
                fiscal.RejectCode,
                fiscal.RejectMessage,
                fiscal.TransmissionAttempts,
                fiscal.LastAttemptAtUtc,
                fiscal.XmlContent,
                fiscal.XmlProtocol,
                fiscal.CreatedAtUtc,
                fiscal.UpdatedAtUtc,
            }
        });
    }


    // â"€â"€ GET /pdv/sales â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>Lista todas as vendas PDV da empresa com paginaÃ§Ã£o e filtros.</summary>
    [HttpGet("sales")]
    public async Task<IActionResult> ListSales(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] Guid? sessionId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? fiscalStatus = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var query = _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<SaleOrderStatus>(status.Trim(), ignoreCase: true, out var parsedStatus))
            query = query.Where(o => o.Status == parsedStatus);

        if (sessionId.HasValue)
            query = query.Where(o => o.CashSessionId == sessionId.Value);

        if (from.HasValue)
            query = query.Where(o => o.CreatedAtUtc >= from.Value);

        if (to.HasValue)
            query = query.Where(o => o.CreatedAtUtc <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(o => o.PublicId.Contains(term) ||
                                     o.CustomerName.Contains(term));
        }

        var total = await query.CountAsync(ct);

        var rawItems = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new
            {
                o.Id,
                o.PublicId,
                o.CashRegisterId,
                o.CashRegisterNameSnapshot,
                o.OperatorUserId,
                o.OperatorName,
                o.CustomerName,
                o.CustomerPhone,
                Status           = o.Status.ToString(),
                o.SubtotalCents,
                o.DiscountCents,
                o.TotalCents,
                o.FiscalDecision,
                o.FiscalDocumentId,
                o.SalesQuoteId,
                o.CreatedAtUtc,
                o.CompletedAtUtc,
                o.CancelledAtUtc,
            })
            .ToListAsync(ct);

        // Enriquecer com dados fiscais (LEFT JOIN manual para evitar cartesian product)
        var fiscalDocIds = rawItems
            .Where(i => i.FiscalDocumentId.HasValue)
            .Select(i => i.FiscalDocumentId!.Value)
            .Distinct()
            .ToList();

        Dictionary<Guid, object?> fiscalMap = new();
        if (fiscalDocIds.Count > 0)
        {
            var fiscalDocs = await _db.FiscalDocuments
                .AsNoTracking()
                .Where(d => fiscalDocIds.Contains(d.Id))
                .Select(d => new
                {
                    d.Id,
                    d.Number,
                    d.Serie,
                    d.AccessKey,
                    FiscalStatus     = d.FiscalStatus.ToString(),
                    ContingencyType  = d.ContingencyType.ToString(),
                    IsContingency    = d.ContingencyType != Petshop.Api.Entities.Fiscal.ContingencyType.None,
                    d.AuthorizationDateTimeUtc,
                    d.RejectCode,
                })
                .ToListAsync(ct);

            foreach (var fd in fiscalDocs)
                fiscalMap[fd.Id] = fd;
        }

        var items = rawItems.Select(o => new
        {
            o.Id,
            o.PublicId,
            o.CashRegisterId,
            o.CashRegisterNameSnapshot,
            o.OperatorUserId,
            o.OperatorName,
            o.CustomerName,
            o.CustomerPhone,
            o.Status,
            o.SubtotalCents,
            o.DiscountCents,
            o.TotalCents,
            o.FiscalDecision,
            o.SalesQuoteId,
            FromDav          = o.SalesQuoteId.HasValue,
            o.CreatedAtUtc,
            o.CompletedAtUtc,
            o.CancelledAtUtc,
            Fiscal           = o.FiscalDocumentId.HasValue && fiscalMap.TryGetValue(o.FiscalDocumentId.Value, out var fd) ? fd : null,
        }).ToList();

        // Filtro por status fiscal (aplicado após JOIN)
        if (!string.IsNullOrWhiteSpace(fiscalStatus))
        {
            items = items.Where(i =>
            {
                if (i.Fiscal is null) return fiscalStatus.Equals("None", StringComparison.OrdinalIgnoreCase);
                var fs = ((dynamic)i.Fiscal).FiscalStatus as string ?? "";
                return fs.Equals(fiscalStatus, StringComparison.OrdinalIgnoreCase);
            }).ToList();
        }

        return Ok(new { page, pageSize, total, items });
    }

    // â"€â"€ POST /pdv/sale/{id}/scan â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>
    /// LÃª um cÃ³digo de barras: detecta balanÃ§a automaticamente,
    /// depois tenta lookup por EAN normal, e adiciona o item Ã  venda.
    /// </summary>
    [HttpPost("sale/{id:guid}/scan")]
    public async Task<IActionResult> ScanBarcode(
        Guid id,
        [FromBody] ScanBarcodeRequest req,
        CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        if (string.IsNullOrWhiteSpace(req.Barcode))
            return BadRequest("Barcode nÃ£o informado.");

        // â"€â"€ 1. Tentar como balanÃ§a â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        if (ScaleBarcodeParser.IsScaleBarcode(req.Barcode))
        {
            var scaleResult = await _scale.ParseAsync(req.Barcode, CompanyId, ct);

            if (!scaleResult.Success)
                return BadRequest(new { scaleResult.ErrorMessage, IsScaleBarcode = true });

            var item = new SaleOrderItem
            {
                ProductId              = scaleResult.ProductId,
                ProductNameSnapshot    = scaleResult.ProductName,
                ProductBarcodeSnapshot = req.Barcode,
                Qty                    = (decimal)(scaleResult.WeightKg ?? 0),
                UnitPriceCentsSnapshot = scaleResult.PricePerKgCents,
                TotalCents             = scaleResult.TotalPriceCents,
                IsSoldByWeight         = true,
                WeightKg               = (decimal)(scaleResult.WeightKg ?? 0)
            };

            var persisted = await InsertSaleItemAndRecalcAsync(sale.Id, item, ct);
            if (!persisted)
                return StatusCode(500, "Falha ao adicionar item lido na venda.");

            return Ok(new { item.Id, item.ProductNameSnapshot, item.Qty,
                            item.TotalCents, IsScaleBarcode = true });
        }

        // â"€â"€ 2. EAN convencional â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Barcode == req.Barcode &&
                                      p.CompanyId == CompanyId && p.IsActive && !p.IsSupply, ct);

        if (product is null)
            return NotFound(new { error = "Produto nÃ£o encontrado para este barcode.", Barcode = req.Barcode });

        var newItem = new SaleOrderItem
        {
            ProductId              = product.Id,
            ProductNameSnapshot    = product.Name,
            ProductBarcodeSnapshot = product.Barcode,
            Qty                    = 1,
            UnitPriceCentsSnapshot = product.PriceCents,
            TotalCents             = product.PriceCents
        };

        var persistedCommon = await InsertSaleItemAndRecalcAsync(sale.Id, newItem, ct);
        if (!persistedCommon)
            return StatusCode(500, "Falha ao adicionar item lido na venda.");

        return Ok(new { newItem.Id, newItem.ProductNameSnapshot, newItem.Qty,
                        newItem.TotalCents, IsScaleBarcode = false });
    }

    // â"€â"€ POST /pdv/sale/{id}/items â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("sale/{id:guid}/items")]
    public async Task<IActionResult> AddItem(
        Guid id,
        [FromBody] AddSaleItemRequest req,
        CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == req.ProductId && p.CompanyId == CompanyId && p.IsActive && !p.IsSupply, ct);

        if (product is null) return BadRequest("Produto nÃ£o encontrado.");

        // Resolve addons selecionados
        var addons = new List<Petshop.Api.Entities.Catalog.ProductAddon>();
        if (req.AddonIds is { Count: > 0 })
        {
            addons = await _db.ProductAddons
                .Where(a => req.AddonIds.Contains(a.Id) && a.ProductId == product.Id && a.IsActive)
                .ToListAsync(ct);
        }
        int addonsCents = addons.Sum(a => a.PriceCents);

        var basePrice = (req.UnitPriceCentsOverride.HasValue && req.UnitPriceCentsOverride.Value > 0)
            ? req.UnitPriceCentsOverride.Value
            : product.PriceCents;
        int unitPriceCents = basePrice + addonsCents;
        int total;
        if (product.IsSoldByWeight)
        {
            if (req.WeightKg is null or <= 0)
                return BadRequest("WeightKg Ã© obrigatÃ³rio para produtos por peso.");
            total = (int)Math.Round(req.WeightKg.Value * unitPriceCents);
        }
        else
        {
            total = (int)Math.Round(req.Qty * unitPriceCents);
        }

        var item = new SaleOrderItem
        {
            ProductId              = product.Id,
            ProductNameSnapshot    = product.Name,
            ProductBarcodeSnapshot = product.Barcode,
            Qty                    = req.Qty,
            UnitPriceCentsSnapshot = unitPriceCents,
            TotalCents             = total,
            IsSoldByWeight         = product.IsSoldByWeight,
            WeightKg               = product.IsSoldByWeight ? req.WeightKg : null,
            Addons                 = addons.Select(a => new SaleOrderItemAddon
            {
                AddonId          = a.Id,
                NameSnapshot     = a.Name,
                PriceCentsSnapshot = a.PriceCents,
            }).ToList()
        };

        var persistedManual = await InsertSaleItemAndRecalcAsync(sale.Id, item, ct);
        if (!persistedManual)
            return StatusCode(500, "Falha ao adicionar item na venda.");

        return Ok(new { item.Id, item.TotalCents });
    }

    // â"€â"€ DELETE /pdv/sale/{id}/items/{itemId} â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpDelete("sale/{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        var item = sale.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return NotFound("Item nÃ£o encontrado.");

        sale.Items.Remove(item);
        RecalcSaleTotals(sale);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // â"€â"€ POST /pdv/sale/{id}/pay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>
    /// Finaliza a venda com um ou mais pagamentos.
    /// Calcula a decisÃ£o fiscal para cada pagamento e persiste.
    /// </summary>
    [HttpPost("sale/{id:guid}/pay")]
    public async Task<IActionResult> Pay(
        Guid id,
        [FromBody] PaySaleRequest req,
        CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Include(o => o.CashSession)
                .ThenInclude(s => s.CashRegister)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        if (!sale.Items.Any())
            return BadRequest("NÃ£o Ã© possÃ­vel finalizar uma venda sem itens.");

        if (req.Payments is null || !req.Payments.Any())
            return BadRequest("Informe ao menos uma forma de pagamento.");

        // Calcula o total final considerando eventual desconto enviado no pagamento.
        var requestedDiscountCents = req.DiscountCents is > 0 ? req.DiscountCents.Value : sale.DiscountCents;
        var discountCents          = Math.Clamp(requestedDiscountCents, 0, sale.SubtotalCents);
        var totalCents             = Math.Max(0, sale.SubtotalCents - discountCents);

        var totalPaid = req.Payments.Sum(p => p.AmountCents);
        if (totalPaid < totalCents)
            return BadRequest($"Valor pago ({totalPaid}Â¢) Ã© inferior ao total da venda ({totalCents}Â¢).");

        // DecisÃ£o fiscal
        var register = sale.CashSession.CashRegister;
        var fiscalSettings = new CashRegisterFiscalSettings
        {
            AutoIssuePix               = register.FiscalAutoIssuePix,
            SendCashContingencyToSefaz = register.FiscalSendCashToSefaz
        };
        var primaryMethod  = req.Payments.OrderByDescending(p => p.AmountCents).First().PaymentMethod;
        var fiscalMethod   = MapToFiscalPaymentMethod(primaryMethod);
        var decision       = _fiscal.Evaluate(fiscalMethod, fiscalSettings);
        var fiscalDecision = decision.ToString();
        var completedAt    = DateTime.UtcNow;
        var finalNotes     = req.Notes ?? sale.Notes;
        var customerDocument = NormalizeCustomerDocument(req.CustomerDocument);
        if (!string.IsNullOrWhiteSpace(req.CustomerDocument) && customerDocument is null)
            return BadRequest("Documento invÃ¡lido. Informe um CPF (11 dÃ­gitos) ou CNPJ (14 dÃ­gitos).");

        // Montar pagamentos com FK explÃ­cito (sem tocar na navigaÃ§Ã£o do sale rastreado)
        var saleId   = sale.Id;
        var payments = req.Payments.Select(p =>
        {
            var change = p.PaymentMethod.ToUpper() is "DINHEIRO" or "CASH"
                ? Math.Max(0, totalPaid - totalCents)
                : 0;
            return new SalePayment
            {
                SaleOrderId   = saleId,
                PaymentMethod = p.PaymentMethod,
                AmountCents   = p.AmountCents,
                ChangeCents   = change,
            };
        }).ToList();

        // TransaÃ§Ã£o explÃ­cita â€" DecrementOnSaleAsync usa ExecuteSqlAsync (sem EF tracking).
        // SaleOrder tambÃ©m Ã© atualizado via SQL direto para evitar DbUpdateConcurrencyException.
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Debita estoque via SQL direto (sem EF tracking, sem concurrency check)
        await _stock.DecrementOnSaleAsync(sale, UserName, ct);

        var customerPhone = string.IsNullOrWhiteSpace(req.CustomerPhone)
            ? sale.CustomerPhone
            : req.CustomerPhone.Trim();
        var normalizedPhoneDigits = string.IsNullOrWhiteSpace(customerPhone)
            ? ""
            : new string(customerPhone.Where(char.IsDigit).ToArray());

        // Venda direta no PDV agora também entra no fluxo oficial de pedidos.
        // Assim ela fica visível no módulo de pedidos e mantém o histórico unificado.
        Order? mirroredOrder = null;
        if (!sale.SalesQuoteId.HasValue)
        {
            mirroredOrder = new Order
            {
                Id = Guid.NewGuid(),
                PublicId = OrderIdGenerator.NewPublicId(),
                CompanyId = CompanyId,
                CustomerId = sale.CustomerId,
                IsPhoneOrder = true,
                AttendantUserId = UserId == Guid.Empty ? null : UserId,
                CustomerName = string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cliente PDV" : sale.CustomerName.Trim(),
                Phone = normalizedPhoneDigits,
                Cep = "",
                Address = "Venda no PDV",
                OriginChannel = "pdv",
                OriginSaleOrderId = sale.Id,
                PaymentMethod = MapToOrderPaymentMethod(primaryMethod),
                SubtotalCents = sale.SubtotalCents,
                DeliveryCents = 0,
                DiscountCents = discountCents,
                TotalCents = totalCents,
                Status = OrderStatus.ENTREGUE,
                CreatedAtUtc = completedAt,
                UpdatedAtUtc = completedAt,
                CashGivenCents = primaryMethod.ToUpperInvariant() is "DINHEIRO" or "CASH" ? totalPaid : null,
                ChangeCents = payments.Sum(p => p.ChangeCents),
            };

            foreach (var saleItem in sale.Items)
            {
                var qty = (saleItem.IsSoldByWeight || saleItem.Qty % 1 != 0m)
                    ? 1
                    : Math.Max(1, (int)Math.Round(saleItem.Qty, MidpointRounding.AwayFromZero));
                var unitPrice = qty > 0 ? Math.Max(0, saleItem.TotalCents / qty) : saleItem.TotalCents;
                mirroredOrder.Items.Add(new OrderItem
                {
                    Id = Guid.NewGuid(),
                    ProductId = saleItem.ProductId,
                    ProductNameSnapshot = saleItem.ProductNameSnapshot,
                    UnitPriceCentsSnapshot = unitPrice,
                    Qty = qty,
                });
            }

            _db.Orders.Add(mirroredOrder);
        }

        // UPDATE SaleOrder via SQL direto (sem EF concurrency check)
        await _db.Database.ExecuteSqlAsync(
            $"""
            UPDATE "SaleOrders"
            SET    "Status"           = 'Completed',
                   "FiscalDecision"   = {fiscalDecision},
                   "CompletedAtUtc"   = {completedAt},
                   "DiscountCents"    = {discountCents},
                   "TotalCents"       = {totalCents},
                   "Notes"            = {finalNotes},
                   "CustomerDocument" = {customerDocument ?? sale.CustomerDocument},
                   "CustomerPhone"    = {customerPhone}
            WHERE  "Id" = {saleId}
            """, ct);

        // Desanexa o sale do tracker para o EF nÃ£o gerar UPDATE duplicado
        _db.Entry(sale).State = EntityState.Detached;

        // INSERT pagamentos com FK explÃ­cito
        foreach (var payment in payments)
            _db.SalePayments.Add(payment);

        // Enfileira emissÃ£o fiscal (exceto contingÃªncia permanente)
        if (fiscalDecision != "PermanentContingency")
        {
            var priority = fiscalDecision == "AutoIssue"
                ? (fiscalMethod == FiscalPaymentMethod.Cash ? FiscalQueuePriority.Normal : FiscalQueuePriority.High)
                : FiscalQueuePriority.Normal;

            _db.FiscalQueues.Add(new FiscalQueue
            {
                CompanyId   = CompanyId,
                SaleOrderId = saleId,
                Priority    = priority,
                Status      = FiscalQueueStatus.Waiting,
            });
        }

        // Salva apenas INSERTs (SalePayments + StockMovements + FiscalQueue)
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // Acumula pontos de fidelidade ANTES de enfileirar o job fiscal.
        // Ordem crítica: o FiscalQueueProcessorJob enfileira NotifySaleCompletedAsync,
        // que por sua vez consulta LoyaltyTransactions para montar o complemento de
        // pontos no WhatsApp. Se o job fiscal for enfileirado primeiro, o Hangfire
        // pode processar toda a cadeia antes de EarnAsync registrar a transação,
        // resultando em earnedPoints = 0 na mensagem ao cliente.
        int earnedPoints = 0;
        var loyaltyCpf = CpfValidator.Normalize(req.CustomerCpfForLoyalty);
        if (sale.CustomerId.HasValue && CpfValidator.IsValid(loyaltyCpf))
        {
            var customerCpfHash = await _db.Customers
                .AsNoTracking()
                .Where(c => c.Id == sale.CustomerId.Value && c.CompanyId == CompanyId)
                .Select(c => c.CpfHash)
                .FirstOrDefaultAsync(ct);

            var inputHash = _cpfProtection.Hash(loyaltyCpf!);
            var isCpfConfirmed = !string.IsNullOrWhiteSpace(customerCpfHash) &&
                                 string.Equals(customerCpfHash, inputHash, StringComparison.Ordinal);

            if (isCpfConfirmed)
            {
                try
                {
                    earnedPoints = await _loyalty.EarnAsync(
                        CompanyId, sale.CustomerId.Value, saleId, totalCents, ct);
                }
                catch { /* fidelidade nao pode derrubar a venda */ }

                // Envia complemento de fidelidade via WhatsApp independente de NFC-e.
                // Sempre enfileira quando CPF é confirmado: o job verifica elegibilidade e idempotência.
                _jobs.Enqueue<WhatsAppNotificationService>(
                    s => s.SendPdvLoyaltyComplementAsync(saleId, CancellationToken.None));
            }
        }

        // Dispara processamento assíncrono da fila fiscal (APÓS loyalty para evitar race condition)
        if (fiscalDecision != "PermanentContingency")
            _jobs.Enqueue<FiscalQueueProcessorJob>(j => j.ProcessAsync(CompanyId, CancellationToken.None));

        // Debita pontos de fidelidade do cupom de desconto, se aplicavel.
        // Opera fora da transacao principal (nao deve derrubar a venda se falhar).
        int spentPoints = 0;
        if (!string.IsNullOrWhiteSpace(req.CouponCode) && sale.CustomerId.HasValue)
        {
            try
            {
                var couponCode = req.CouponCode.Trim().ToUpperInvariant();
                var couponPromotion = await _db.Promotions
                    .AsNoTracking()
                    .Where(p => p.CompanyId == CompanyId &&
                                p.CouponCode == couponCode &&
                                p.IsActive &&
                                p.LoyaltyPointsCost != null && p.LoyaltyPointsCost > 0)
                    .FirstOrDefaultAsync(ct);

                if (couponPromotion != null)
                {
                    var result = await _loyalty.RedeemPromotionAsync(
                        CompanyId, sale.CustomerId.Value, couponPromotion.Id, saleId, ct);
                    spentPoints = result.PointsSpent;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Loyalty] Falha ao debitar pontos do cupom {Code} na venda {SaleId}.",
                    req.CouponCode, saleId);
            }
        }

        return Ok(new
        {
            Id           = saleId,
            sale.PublicId,
            TotalCents   = totalCents,
            FiscalDecision = fiscalDecision,
            ChangeCents  = payments.Sum(p => p.ChangeCents),
            EarnedPoints = earnedPoints,
            SpentPoints  = spentPoints,
            MirroredOrderId = mirroredOrder?.Id,
            MirroredOrderPublicId = mirroredOrder?.PublicId,
        });
    }

    // -- PATCH /pdv/sale/{id}/customer ----------------------------------------
    /// <summary>
    /// Vincula (ou atualiza) o cliente de uma venda ainda aberta.
    /// Chamado quando o operador identifica o cliente APOS a venda ter sido criada.
    /// </summary>
    [HttpPatch("sale/{id:guid}/customer")]
    public async Task<IActionResult> UpdateSaleCustomer(
        Guid id,
        [FromBody] UpdateSaleCustomerRequest req,
        CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nao encontrada ou ja finalizada.");

        // Valida que o customerId pertence a esta empresa
        if (req.CustomerId.HasValue)
        {
            var exists = await _db.Customers
                .AnyAsync(c => c.Id == req.CustomerId.Value && c.CompanyId == CompanyId, ct);
            if (!exists) return BadRequest("Cliente nao encontrado.");
        }

        sale.CustomerId    = req.CustomerId;
        sale.CustomerName  = string.IsNullOrWhiteSpace(req.CustomerName) ? sale.CustomerName : req.CustomerName.Trim();
        sale.CustomerPhone = string.IsNullOrWhiteSpace(req.CustomerPhone) ? sale.CustomerPhone : req.CustomerPhone.Trim();

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            sale.Id,
            sale.CustomerId,
            sale.CustomerName,
            sale.CustomerPhone,
        });
    }

    // -- PATCH /pdv/sale/{id}/customer-phone ----------------------------------
    /// <summary>
    /// Atualiza o telefone do cliente em uma venda ja finalizada,
    /// permitindo que o job fiscal envie o comprovante por WhatsApp.
    /// Chamado pelo PDV apos o modal pos-venda.
    /// </summary>
    [HttpPatch("sale/{id:guid}/customer-phone")]
    public async Task<IActionResult> UpdateCustomerPhone(
        Guid id,
        [FromBody] UpdateCustomerPhoneRequest req,
        CancellationToken ct)
    {
        var affected = await _db.Database.ExecuteSqlAsync(
            $"""
            UPDATE "SaleOrders"
            SET    "CustomerPhone" = {req.CustomerPhone}
            WHERE  "Id"        = {id}
              AND  "CompanyId" = {CompanyId}
            """, ct);

        if (affected == 0) return NotFound();

        // Dispara envio do comprovante agora que o telefone estÃ¡ salvo.
        // IdempotÃªncia no job impede duplo envio se fiscal jÃ¡ tiver disparado antes.
        _jobs.Enqueue<WhatsAppNotificationService>(
            s => s.NotifySaleCompletedAsync(id, CancellationToken.None));

        return NoContent();
    }

    // â"€â"€ POST /pdv/sale/{id}/cancel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpPost("sale/{id:guid}/cancel")]
    public async Task<IActionResult> CancelSale(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        sale.Status        = SaleOrderStatus.Cancelled;
        sale.CancelledAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { sale.Id, sale.Status });
    }

    // â"€â"€ POST /pdv/sale/{id}/import-dav â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>
    /// Importa itens de um DAV (por PublicId) para uma venda aberta.
    /// O caixa escaneia o cÃ³digo de barras do orÃ§amento impresso.
    /// Usa raw SQL para todos os UPDATEs (evita DbUpdateConcurrencyException).
    /// </summary>
    [HttpPost("sale/{id:guid}/import-dav")]
    public async Task<IActionResult> ImportDav(
        Guid id,
        [FromBody] ImportDavRequest req,
        CancellationToken ct)
    {
        // Normaliza: aceita "DAV-XXXXXXXX" ou apenas "XXXXXXXX"
        var quoteCode = req.QuoteCode.Trim();

        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada ou jÃ¡ finalizada.");

        var dav = await _db.SalesQuotes
            .AsNoTracking()
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.PublicId == quoteCode &&
                                      q.CompanyId == CompanyId &&
                                      q.Status != SalesQuoteStatus.Converted &&
                                      q.Status != SalesQuoteStatus.Cancelled, ct);

        if (dav is null) return BadRequest("OrÃ§amento nÃ£o encontrado ou jÃ¡ utilizado.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            int itemsAdded = 0;

            // Merge DAV items â†’ sale (INSERT novos / UPDATE qty existentes â€" via SQL)
            foreach (var davItem in dav.Items)
            {
                var existing = sale.Items.FirstOrDefault(i =>
                    i.ProductId == davItem.ProductId && !i.IsSoldByWeight);

                if (existing != null)
                {
                    var newQty   = existing.Qty + davItem.Qty;
                    var newTotal = (int)Math.Round((double)newQty * (double)existing.UnitPriceCentsSnapshot);
                    await _db.Database.ExecuteSqlAsync(
                        $"""
                        UPDATE "SaleOrderItems"
                        SET "Qty" = {newQty}, "TotalCents" = {newTotal}
                        WHERE "Id" = {existing.Id}
                        """, ct);
                }
                else
                {
                    var newItem = new SaleOrderItem
                    {
                        SaleOrderId            = id,
                        ProductId              = davItem.ProductId,
                        ProductNameSnapshot    = davItem.ProductNameSnapshot,
                        ProductBarcodeSnapshot = davItem.ProductBarcodeSnapshot,
                        Qty                    = davItem.Qty,
                        UnitPriceCentsSnapshot = davItem.UnitPriceCentsSnapshot,
                        TotalCents             = davItem.TotalCents,
                        IsSoldByWeight         = davItem.IsSoldByWeight,
                        WeightKg               = davItem.WeightKg
                    };
                    _db.SaleOrderItems.Add(newItem);
                    await _db.SaveChangesAsync(ct);
                }
                itemsAdded++;
            }

            // Recalc totals via SQL
            await _db.Database.ExecuteSqlAsync(
                $"""
                UPDATE "SaleOrders" s
                SET "SubtotalCents" = COALESCE(items."Subtotal", 0),
                    "TotalCents"    = GREATEST(0, COALESCE(items."Subtotal", 0) - s."DiscountCents"),
                    "SalesQuoteId"  = {dav.Id},
                    "CustomerName"  = CASE WHEN s."CustomerName" = '' OR s."CustomerName" IS NULL
                                          THEN {dav.CustomerName ?? ""}
                                          ELSE s."CustomerName"
                                     END,
                    "CustomerPhone" = CASE WHEN s."CustomerPhone" = '' OR s."CustomerPhone" IS NULL
                                          THEN {dav.CustomerPhone}
                                          ELSE s."CustomerPhone"
                                     END
                FROM (
                    SELECT "SaleOrderId", SUM("TotalCents")::int AS "Subtotal"
                    FROM "SaleOrderItems" WHERE "SaleOrderId" = {id}
                    GROUP BY "SaleOrderId"
                ) items
                WHERE s."Id" = {id}
                """, ct);

            // Marca DAV como Convertido via SQL
            var now = DateTime.UtcNow;
            await _db.Database.ExecuteSqlAsync(
                $"""
                UPDATE "SalesQuotes"
                SET "Status"         = 'Converted',
                    "SaleOrderId"    = {id},
                    "ConvertedAtUtc" = {now},
                    "UpdatedAtUtc"   = {now}
                WHERE "Id" = {dav.Id}
                """, ct);

            // DAV de mesa: ao importar no caixa, encerra a comanda da mesa automaticamente.
            if (dav.Origin == Entities.Dav.SalesQuoteOrigin.TableOrder && dav.OriginOrderId.HasValue)
            {
                var nowTable = DateTime.UtcNow;
                await _db.Database.ExecuteSqlAsync(
                    $"""
                    UPDATE "Orders"
                    SET "Status" = {(int)Petshop.Api.Entities.OrderStatus.ENTREGUE},
                        "UpdatedAtUtc" = {nowTable}
                    WHERE "Id" = {dav.OriginOrderId.Value}
                      AND "CompanyId" = {CompanyId}
                      AND "Status" <> {(int)Petshop.Api.Entities.OrderStatus.CANCELADO}
                    """, ct);
            }

            await tx.CommitAsync(ct);

            // Retorna totais atualizados
            var updated = await _db.SaleOrders
                .AsNoTracking()
                .Select(o => new { o.Id, o.SubtotalCents, o.TotalCents })
                .FirstOrDefaultAsync(o => o.Id == id, ct);

            var suggestedAmountCents = updated?.TotalCents ?? 0;
            var davMethodUpper = (dav.PaymentMethod ?? "").Trim().ToUpperInvariant();
            if ((davMethodUpper == "CASH" || davMethodUpper == "DINHEIRO") && dav.OriginOrderId.HasValue)
            {
                var sourceOrderCash = await _db.Orders
                    .AsNoTracking()
                    .Where(o => o.CompanyId == CompanyId && o.Id == dav.OriginOrderId.Value)
                    .Select(o => o.CashGivenCents)
                    .FirstOrDefaultAsync(ct);

                if (sourceOrderCash.HasValue && sourceOrderCash.Value > 0)
                    suggestedAmountCents = sourceOrderCash.Value;
            }

            return Ok(new
            {
                sale.Id,
                ItemsAdded    = itemsAdded,
                dav.PublicId,
                dav.PaymentMethod,
                SuggestedAmountCents = suggestedAmountCents,
                SubtotalCents = updated?.SubtotalCents ?? 0,
                TotalCents    = updated?.TotalCents ?? 0,
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "[ImportDav] Erro ao importar DAV {QuoteCode} para venda {SaleId}.", quoteCode, id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // â"€â"€ GET /pdv/sale/{id}/cupom â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>
    /// Retorna os dados do cupom em JSON para renderizaÃ§Ã£o no frontend.
    /// O frontend imprime via window.print() com CSS 80mm.
    /// </summary>
    [HttpGet("sale/{id:guid}/cupom")]
    public async Task<IActionResult> GetCupom(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Addons)
            .Include(o => o.Payments)
            .Include(o => o.CashSession)
                .ThenInclude(s => s.CashRegister)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);

        if (sale is null) return NotFound("Venda nÃ£o encontrada.");

        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == CompanyId, ct);

        return Ok(new
        {
            CompanyName    = company?.Name ?? "",
            sale.PublicId,
            sale.CustomerName,
            RegisterName   = sale.CashSession.CashRegister.Name,
            sale.CreatedAtUtc,
            sale.CompletedAtUtc,
            sale.SubtotalCents,
            sale.DiscountCents,
            sale.TotalCents,
            sale.FiscalDecision,
            Items = sale.Items.Select(i => new
            {
                i.ProductNameSnapshot,
                i.Qty,
                i.UnitPriceCentsSnapshot,
                UnitBaseCents = i.UnitPriceCentsSnapshot - i.Addons.Sum(a => a.PriceCentsSnapshot),
                i.TotalCents,
                i.IsSoldByWeight,
                i.WeightKg,
                Addons = i.Addons.Select(a => new
                {
                    a.NameSnapshot,
                    a.PriceCentsSnapshot
                })
            }),
            Payments = sale.Payments.Select(p => new
            {
                p.PaymentMethod,
                p.AmountCents,
                p.ChangeCents
            })
        });
    }

    // â"€â"€ GET /pdv/session/{sessionId}/sales â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    [HttpGet("session/{sessionId:guid}/sales")]
    public async Task<IActionResult> ListSessionSales(Guid sessionId, CancellationToken ct)
    {
        var sessionExists = await _db.CashSessions
            .AnyAsync(s => s.Id == sessionId && s.CompanyId == CompanyId, ct);

        if (!sessionExists) return NotFound("SessÃ£o nÃ£o encontrada.");

        var sales = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Payments)
            .Where(o => o.CashSessionId == sessionId)
            .OrderByDescending(o => o.CreatedAtUtc)
            .Select(o => new
            {
                o.Id,
                o.PublicId,
                o.CustomerName,
                o.TotalCents,
                o.Status,
                o.FiscalDecision,
                o.CreatedAtUtc,
                o.CompletedAtUtc,
                PaymentMethods = o.Payments.Select(p => p.PaymentMethod).ToList()
            })
            .ToListAsync(ct);

        return Ok(sales);
    }

    // â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    private static void RecalcSaleTotals(SaleOrder sale)
    {
        sale.SubtotalCents = sale.Items.Sum(i => i.TotalCents);
        sale.TotalCents    = Math.Max(0, sale.SubtotalCents - sale.DiscountCents);
    }

    // â"€â"€ DELETE /pdv/sales/all â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    /// <summary>
    /// Apaga TODAS as vendas (SaleOrders), sessÃµes de caixa e documentos fiscais
    /// da empresa. Use apenas para ambiente de testes.
    /// Requer role "admin".
    /// </summary>
    [HttpDelete("sales/all")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteAllSales(CancellationToken ct)
    {
        var companyId = CompanyId;

        // Fiscal documents
        var fiscalIds = await _db.FiscalDocuments
            .Where(f => f.CompanyId == companyId)
            .Select(f => f.Id)
            .ToListAsync(ct);

        if (fiscalIds.Any())
            await _db.FiscalDocuments
                .Where(f => fiscalIds.Contains(f.Id))
                .ExecuteDeleteAsync(ct);

        // Sale orders (cascades items, payments, addons via FK cascade or EF)
        var deletedSales = await _db.SaleOrders
            .Where(s => s.CompanyId == companyId)
            .ExecuteDeleteAsync(ct);

        // Cash sessions
        var deletedSessions = await _db.CashSessions
            .Where(s => s.CompanyId == companyId)
            .ExecuteDeleteAsync(ct);

        return Ok(new { deletedSales, deletedSessions, deletedFiscalDocs = fiscalIds.Count });
    }

    private async Task<bool> InsertSaleItemAndRecalcAsync(Guid saleId, SaleOrderItem item, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO ""SaleOrderItems""
(""Id"", ""SaleOrderId"", ""ProductId"", ""ProductNameSnapshot"", ""ProductBarcodeSnapshot"", ""Qty"", ""UnitPriceCentsSnapshot"", ""TotalCents"", ""IsSoldByWeight"", ""WeightKg"")
VALUES
({item.Id}, {saleId}, {item.ProductId}, {item.ProductNameSnapshot}, {item.ProductBarcodeSnapshot}, {item.Qty}, {item.UnitPriceCentsSnapshot}, {item.TotalCents}, {item.IsSoldByWeight}, {item.WeightKg});", ct);

            if (item.Addons is { Count: > 0 })
            {
                foreach (var addon in item.Addons)
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO ""SaleOrderItemAddons""
(""Id"", ""SaleOrderItemId"", ""AddonId"", ""NameSnapshot"", ""PriceCentsSnapshot"")
VALUES
({addon.Id}, {item.Id}, {addon.AddonId}, {addon.NameSnapshot}, {addon.PriceCentsSnapshot});", ct);
                }
            }

            await _db.Database.ExecuteSqlInterpolatedAsync($@"
UPDATE ""SaleOrders"" s
SET
  ""SubtotalCents"" = COALESCE(items.""Subtotal"", 0),
  ""TotalCents""    = GREATEST(0, COALESCE(items.""Subtotal"", 0) - s.""DiscountCents"")
FROM (
  SELECT ""SaleOrderId"", SUM(""TotalCents"")::int AS ""Subtotal""
  FROM ""SaleOrderItems""
  WHERE ""SaleOrderId"" = {saleId}
  GROUP BY ""SaleOrderId""
) items
WHERE s.""Id"" = {saleId};", ct);

            await tx.CommitAsync(ct);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            return false;
        }
    }

    private static Entities.Fiscal.FiscalPaymentMethod MapToFiscalPaymentMethod(string method) =>
        method.ToUpper() switch
        {
            "DINHEIRO" or "CASH"         => Entities.Fiscal.FiscalPaymentMethod.Cash,
            "PIX"                         => Entities.Fiscal.FiscalPaymentMethod.Pix,
            "CARTAO_CREDITO" or "CARTAO_DEBITO" or "CARD" or "CARTAO"
                                          => Entities.Fiscal.FiscalPaymentMethod.Card,
            "CHEQUE" or "CHECK"           => Entities.Fiscal.FiscalPaymentMethod.Check,
            _                             => Entities.Fiscal.FiscalPaymentMethod.Other
        };

    private static string MapToOrderPaymentMethod(string method) =>
        method.ToUpperInvariant() switch
        {
            "DINHEIRO" or "CASH" => "CASH",
            "CARTAO_CREDITO" or "CARTAO_DEBITO" or "CARD" or "CARTAO" => "CARD_ON_DELIVERY",
            "PIX" => "PIX",
            _ => method.ToUpperInvariant()
        };

    private static string? NormalizeCustomerDocument(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        return digits.Length is 11 or 14 ? digits : null;
    }

    private static object MapSession(CashSession s) => new
    {
        s.Id,
        s.CashRegisterId,
        RegisterName       = s.CashRegister.Name,
        FiscalSerie        = s.CashRegister.FiscalSerie,
        s.OpenedByUserName,
        s.Status,
        s.OpeningBalanceCents,
        s.OpenedAtUtc
    };

    private static object MapSale(
        SaleOrder o,
        Petshop.Api.Entities.Fiscal.FiscalDocument? fiscal = null) => new
    {
        o.Id,
        o.PublicId,
        o.CashSessionId,
        o.CashRegisterId,
        o.CashRegisterNameSnapshot,
        o.OperatorUserId,
        o.OperatorName,
        o.CustomerName,
        o.CustomerPhone,
        o.CustomerDocument,
        o.SubtotalCents,
        o.DiscountCents,
        o.TotalCents,
        Status         = o.Status.ToString(),
        o.FiscalDecision,
        o.FiscalDocumentId,
        o.SalesQuoteId,
        FromDav        = o.SalesQuoteId.HasValue,
        o.Notes,
        o.CreatedAtUtc,
        o.CompletedAtUtc,
        o.CancelledAtUtc,
        Fiscal = fiscal == null ? null : (object)new
        {
            fiscal.Id,
            fiscal.Number,
            fiscal.Serie,
            fiscal.AccessKey,
            FiscalStatus    = fiscal.FiscalStatus.ToString(),
            ContingencyType = fiscal.ContingencyType.ToString(),
            IsContingency   = fiscal.ContingencyType != Petshop.Api.Entities.Fiscal.ContingencyType.None,
            fiscal.AuthorizationCode,
            fiscal.AuthorizationDateTimeUtc,
            fiscal.RejectCode,
            fiscal.RejectMessage,
            fiscal.TransmissionAttempts,
            fiscal.LastAttemptAtUtc,
            HasXml          = fiscal.XmlContent != null,
            fiscal.CreatedAtUtc,
        },
        Items = o.Items.Select(i => new
        {
            i.Id, i.ProductId, i.ProductNameSnapshot, i.ProductBarcodeSnapshot,
            i.Qty, i.UnitPriceCentsSnapshot, i.TotalCents, i.IsSoldByWeight, i.WeightKg,
            Addons = i.Addons.Select(a => new { a.AddonId, a.NameSnapshot, a.PriceCentsSnapshot })
        }),
        Payments = o.Payments.Select(p => new
        {
            p.Id, p.PaymentMethod, p.AmountCents, p.ChangeCents
        })
    };
}

// â"€â"€ Requests â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

public record OpenSessionRequest(
    Guid CashRegisterId,
    int OpeningBalanceCents = 0,
    string? Notes = null
);

public record CloseSessionRequest(
    int? ClosingBalanceCents,
    string? Notes = null
);

public record CreateSaleRequest(
    Guid CashSessionId,
    string? CustomerName = null,
    string? CustomerPhone = null,
    Guid? CustomerId = null,
    Guid? SalesQuoteId = null
);

public record ScanBarcodeRequest(string Barcode);

public record AddSaleItemRequest(
    Guid ProductId,
    decimal Qty = 1,
    decimal? WeightKg = null,
    List<Guid>? AddonIds = null,
    /// <summary>PreÃ§o unitÃ¡rio com desconto/promoÃ§Ã£o calculado pelo frontend. Quando informado, substitui product.PriceCents.</summary>
    int? UnitPriceCentsOverride = null
);

public record PaymentEntry(string PaymentMethod, int AmountCents);

public record PaySaleRequest(
    IReadOnlyList<PaymentEntry> Payments,
    int? DiscountCents = null,
    string? Notes = null,
    string? CustomerDocument = null,
    string? CustomerPhone = null,
    string? CustomerCpfForLoyalty = null,
    /// <summary>Codigo do cupom de desconto aplicado (para debitar pontos de fidelidade).</summary>
    string? CouponCode = null
);

public record AddMovementRequest(
    string Type,        // "Sangria" | "Suprimento"
    int    AmountCents,
    string? Description = null
);

public record ImportDavRequest(string QuoteCode);

public record UpdateCustomerPhoneRequest(string CustomerPhone);

public record UpdateSaleCustomerRequest(
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerPhone
);



