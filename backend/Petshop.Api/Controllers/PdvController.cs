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
using Petshop.Api.Services.Scale;
using Petshop.Api.Services.Customers;
using Petshop.Api.Services.Stock;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// PDV — sessão de caixa e ciclo de venda.
/// Todos os endpoints exigem JWT de admin/gerente/atendente.
/// </summary>
[ApiController]
[Route("pdv")]
[Authorize(Roles = "admin,gerente,atendente")]
public class PdvController : ControllerBase
{
    private readonly AppDbContext          _db;
    private readonly ScaleBarcodeParser    _scale;
    private readonly FiscalDecisionService _fiscal;
    private readonly IBackgroundJobClient  _jobs;
    private readonly StockService          _stock;
    private readonly LoyaltyService        _loyalty;

    public PdvController(AppDbContext db, ScaleBarcodeParser scale, FiscalDecisionService fiscal, IBackgroundJobClient jobs, StockService stock, LoyaltyService loyalty)
    {
        _db      = db;
        _scale   = scale;
        _fiscal  = fiscal;
        _jobs    = jobs;
        _stock   = stock;
        _loyalty = loyalty;
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

    // ══════════════════════════════════════════════════════════════════════════
    // SESSÃO DE CAIXA
    // ══════════════════════════════════════════════════════════════════════════

    // ── GET /pdv/session/current ──────────────────────────────────────────────
    /// <summary>Retorna a sessão aberta da empresa (uma por vez), ou null.</summary>
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

    // ── POST /pdv/session/open ────────────────────────────────────────────────
    [HttpPost("session/open")]
    public async Task<IActionResult> OpenSession(
        [FromBody] OpenSessionRequest req,
        CancellationToken ct)
    {
        var register = await _db.CashRegisters
            .FirstOrDefaultAsync(r => r.Id == req.CashRegisterId &&
                                      r.CompanyId == CompanyId && r.IsActive, ct);

        if (register is null) return BadRequest("Terminal não encontrado ou inativo.");

        var existingOpen = await _db.CashSessions
            .AnyAsync(s => s.CashRegisterId == req.CashRegisterId &&
                           s.Status == CashSessionStatus.Open, ct);

        if (existingOpen)
            return Conflict("Este terminal já possui uma sessão aberta.");

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

    // ── POST /pdv/session/{sessionId}/close ───────────────────────────────────
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

        if (session is null) return NotFound("Sessão não encontrada ou já fechada.");

        // Não permite fechar com vendas abertas
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

    // ── GET /pdv/session/{sessionId}/report ───────────────────────────────────
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

        if (session is null) return NotFound("Sessão não encontrada.");

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

    // ── GET /pdv/session/{sessionId}/movements ────────────────────────────────
    [HttpGet("session/{sessionId:guid}/movements")]
    public async Task<IActionResult> ListMovements(Guid sessionId, CancellationToken ct)
    {
        var exists = await _db.CashSessions
            .AnyAsync(s => s.Id == sessionId && s.CompanyId == CompanyId, ct);
        if (!exists) return NotFound("Sessão não encontrada.");

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

    // ── POST /pdv/session/{sessionId}/movements ───────────────────────────────
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
        if (session is null) return NotFound("Sessão não encontrada ou já fechada.");

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

    // ══════════════════════════════════════════════════════════════════════════
    // VENDA
    // ══════════════════════════════════════════════════════════════════════════

    // ── POST /pdv/sale ────────────────────────────────────────────────────────
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
            return BadRequest("Sessão não encontrada ou já fechada.");

        var sale = new SaleOrder
        {
            CompanyId      = CompanyId,
            PublicId       = $"PDV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(0, 999999):D6}",
            CashSessionId  = session.Id,
            CashRegisterId = session.CashRegisterId,
            CustomerName   = req.CustomerName ?? "",
            CustomerPhone  = req.CustomerPhone,
            Status         = SaleOrderStatus.Open
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
                return BadRequest("DAV não encontrado ou não pode ser importado.");

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

    // ── GET /pdv/sale/{id} ────────────────────────────────────────────────────
    [HttpGet("sale/{id:guid}")]
    public async Task<IActionResult> GetSale(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);

        if (sale is null) return NotFound("Venda não encontrada.");

        return Ok(MapSale(sale));
    }

    // ── POST /pdv/sale/{id}/scan ──────────────────────────────────────────────
    /// <summary>
    /// Lê um código de barras: detecta balança automaticamente,
    /// depois tenta lookup por EAN normal, e adiciona o item à venda.
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

        if (sale is null) return NotFound("Venda não encontrada ou já finalizada.");

        if (string.IsNullOrWhiteSpace(req.Barcode))
            return BadRequest("Barcode não informado.");

        // ── 1. Tentar como balança ───────────────────────────
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

        // ── 2. EAN convencional ──────────────────────────────
        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Barcode == req.Barcode &&
                                      p.CompanyId == CompanyId && p.IsActive, ct);

        if (product is null)
            return NotFound(new { error = "Produto não encontrado para este barcode.", Barcode = req.Barcode });

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

    // ── POST /pdv/sale/{id}/items ─────────────────────────────────────────────
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

        if (sale is null) return NotFound("Venda não encontrada ou já finalizada.");

        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == req.ProductId && p.CompanyId == CompanyId && p.IsActive, ct);

        if (product is null) return BadRequest("Produto não encontrado.");

        int total;
        if (product.IsSoldByWeight)
        {
            if (req.WeightKg is null or <= 0)
                return BadRequest("WeightKg é obrigatório para produtos por peso.");
            total = (int)Math.Round(req.WeightKg.Value * product.PriceCents);
        }
        else
        {
            total = (int)Math.Round(req.Qty * product.PriceCents);
        }

        var item = new SaleOrderItem
        {
            ProductId              = product.Id,
            ProductNameSnapshot    = product.Name,
            ProductBarcodeSnapshot = product.Barcode,
            Qty                    = req.Qty,
            UnitPriceCentsSnapshot = product.PriceCents,
            TotalCents             = total,
            IsSoldByWeight         = product.IsSoldByWeight,
            WeightKg               = product.IsSoldByWeight ? req.WeightKg : null
        };

        var persistedManual = await InsertSaleItemAndRecalcAsync(sale.Id, item, ct);
        if (!persistedManual)
            return StatusCode(500, "Falha ao adicionar item na venda.");

        return Ok(new { item.Id, item.TotalCents });
    }

    // ── DELETE /pdv/sale/{id}/items/{itemId} ──────────────────────────────────
    [HttpDelete("sale/{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda não encontrada ou já finalizada.");

        var item = sale.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return NotFound("Item não encontrado.");

        sale.Items.Remove(item);
        RecalcSaleTotals(sale);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── POST /pdv/sale/{id}/pay ───────────────────────────────────────────────
    /// <summary>
    /// Finaliza a venda com um ou mais pagamentos.
    /// Calcula a decisão fiscal para cada pagamento e persiste.
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

        if (sale is null) return NotFound("Venda não encontrada ou já finalizada.");

        if (!sale.Items.Any())
            return BadRequest("Não é possível finalizar uma venda sem itens.");

        if (req.Payments is null || !req.Payments.Any())
            return BadRequest("Informe ao menos uma forma de pagamento.");

        var totalPaid = req.Payments.Sum(p => p.AmountCents);
        if (totalPaid < sale.TotalCents)
            return BadRequest($"Valor pago ({totalPaid}¢) é inferior ao total da venda ({sale.TotalCents}¢).");

        // Aplicar desconto
        if (req.DiscountCents is > 0)
        {
            sale.DiscountCents = req.DiscountCents.Value;
            sale.TotalCents    = Math.Max(0, sale.SubtotalCents - sale.DiscountCents);
        }

        // Adicionar pagamentos
        var register = sale.CashSession.CashRegister;
        var fiscalSettings = new CashRegisterFiscalSettings
        {
            AutoIssuePix          = register.FiscalAutoIssuePix,
            SendCashContingencyToSefaz = register.FiscalSendCashToSefaz
        };

        foreach (var p in req.Payments)
        {
            var changeCents = p.PaymentMethod.ToUpper() is "DINHEIRO" or "CASH"
                ? Math.Max(0, totalPaid - sale.TotalCents)
                : 0;

            sale.Payments.Add(new SalePayment
            {
                PaymentMethod = p.PaymentMethod,
                AmountCents   = p.AmountCents,
                ChangeCents   = changeCents
            });
        }

        // Determinar decisão fiscal (usa primeiro pagamento principal)
        var primaryMethod = req.Payments.OrderByDescending(p => p.AmountCents).First().PaymentMethod;
        var fiscalMethod  = MapToFiscalPaymentMethod(primaryMethod);
        var decision      = _fiscal.Evaluate(fiscalMethod, fiscalSettings);

        sale.FiscalDecision = decision.ToString();
        sale.Status         = SaleOrderStatus.Completed;
        sale.CompletedAtUtc = DateTime.UtcNow;
        if (req.Notes is not null) sale.Notes = req.Notes;

        // Transação explícita: DecrementOnSaleAsync usa ExecuteSqlAsync (direto),
        // enquanto Sale/Payment/StockMovements/FiscalQueue são salvos via SaveChangesAsync.
        // Ambos participam da mesma conexão/transação para garantir atomicidade.
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Debita estoque via SQL direto (sem EF tracking, sem concurrency check)
        await _stock.DecrementOnSaleAsync(sale, UserName, ct);

        // Enfileira emissão fiscal (exceto contingência permanente)
        if (sale.FiscalDecision != "PermanentContingency")
        {
            var priority = sale.FiscalDecision == "AutoIssue"
                ? (fiscalMethod == FiscalPaymentMethod.Cash ? FiscalQueuePriority.Normal : FiscalQueuePriority.High)
                : FiscalQueuePriority.Normal;

            _db.FiscalQueues.Add(new FiscalQueue
            {
                CompanyId   = CompanyId,
                SaleOrderId = sale.Id,
                Priority    = priority,
                Status      = FiscalQueueStatus.Waiting,
            });
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // Dispara processamento assíncrono da fila fiscal
        if (sale.FiscalDecision != "PermanentContingency")
            _jobs.Enqueue<FiscalQueueProcessorJob>(j => j.ProcessAsync(CompanyId, CancellationToken.None));

        // Acumula pontos de fidelidade (fire-and-forget — não bloqueia o PDV)
        int earnedPoints = 0;
        if (sale.CustomerId.HasValue)
        {
            try
            {
                earnedPoints = await _loyalty.EarnAsync(
                    CompanyId, sale.CustomerId.Value, sale.Id, sale.TotalCents, ct);
            }
            catch { /* fidelidade não pode derrubar a venda */ }
        }

        return Ok(new
        {
            sale.Id,
            sale.PublicId,
            sale.TotalCents,
            sale.FiscalDecision,
            ChangeCents  = sale.Payments.Sum(p => p.ChangeCents),
            EarnedPoints = earnedPoints,
        });
    }

    // ── POST /pdv/sale/{id}/cancel ────────────────────────────────────────────
    [HttpPost("sale/{id:guid}/cancel")]
    public async Task<IActionResult> CancelSale(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId &&
                                      o.Status == SaleOrderStatus.Open, ct);

        if (sale is null) return NotFound("Venda não encontrada ou já finalizada.");

        sale.Status        = SaleOrderStatus.Cancelled;
        sale.CancelledAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { sale.Id, sale.Status });
    }

    // ── GET /pdv/sale/{id}/cupom ──────────────────────────────────────────────
    /// <summary>
    /// Retorna os dados do cupom em JSON para renderização no frontend.
    /// O frontend imprime via window.print() com CSS 80mm.
    /// </summary>
    [HttpGet("sale/{id:guid}/cupom")]
    public async Task<IActionResult> GetCupom(Guid id, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Include(o => o.CashSession)
                .ThenInclude(s => s.CashRegister)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);

        if (sale is null) return NotFound("Venda não encontrada.");

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
                i.TotalCents,
                i.IsSoldByWeight,
                i.WeightKg
            }),
            Payments = sale.Payments.Select(p => new
            {
                p.PaymentMethod,
                p.AmountCents,
                p.ChangeCents
            })
        });
    }

    // ── GET /pdv/session/{sessionId}/sales ────────────────────────────────────
    [HttpGet("session/{sessionId:guid}/sales")]
    public async Task<IActionResult> ListSessionSales(Guid sessionId, CancellationToken ct)
    {
        var sessionExists = await _db.CashSessions
            .AnyAsync(s => s.Id == sessionId && s.CompanyId == CompanyId, ct);

        if (!sessionExists) return NotFound("Sessão não encontrada.");

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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void RecalcSaleTotals(SaleOrder sale)
    {
        sale.SubtotalCents = sale.Items.Sum(i => i.TotalCents);
        sale.TotalCents    = Math.Max(0, sale.SubtotalCents - sale.DiscountCents);
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

    private static object MapSale(SaleOrder o) => new
    {
        o.Id,
        o.PublicId,
        o.CashSessionId,
        o.CustomerName,
        o.CustomerPhone,
        o.SubtotalCents,
        o.DiscountCents,
        o.TotalCents,
        Status         = o.Status.ToString(),
        o.FiscalDecision,
        o.SalesQuoteId,
        o.Notes,
        o.CreatedAtUtc,
        o.CompletedAtUtc,
        Items = o.Items.Select(i => new
        {
            i.Id, i.ProductId, i.ProductNameSnapshot, i.ProductBarcodeSnapshot,
            i.Qty, i.UnitPriceCentsSnapshot, i.TotalCents, i.IsSoldByWeight, i.WeightKg
        }),
        Payments = o.Payments.Select(p => new
        {
            p.Id, p.PaymentMethod, p.AmountCents, p.ChangeCents
        })
    };
}

// ── Requests ──────────────────────────────────────────────────────────────────

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
    Guid? SalesQuoteId = null
);

public record ScanBarcodeRequest(string Barcode);

public record AddSaleItemRequest(
    Guid ProductId,
    decimal Qty = 1,
    decimal? WeightKg = null
);

public record PaymentEntry(string PaymentMethod, int AmountCents);

public record PaySaleRequest(
    IReadOnlyList<PaymentEntry> Payments,
    int? DiscountCents = null,
    string? Notes = null
);

public record AddMovementRequest(
    string Type,        // "Sangria" | "Suprimento"
    int    AmountCents,
    string? Description = null
);
