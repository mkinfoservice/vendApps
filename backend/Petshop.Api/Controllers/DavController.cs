using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Admin.Dav;
using Petshop.Api.Data;
using Petshop.Api.Entities.Dav;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Services.Dav;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// CRUD de DAV (Documento Auxiliar de Venda / Orçamento).
/// Fase 2: criação manual, geração automática de delivery, confirmação fiscal e conversão para PDV.
/// </summary>
[ApiController]
[Route("admin/dav")]
[Authorize(Roles = "admin,gerente,atendente")]
public class DavController : ControllerBase
{
    private readonly AppDbContext _db;

    public DavController(AppDbContext db)
    {
        _db = db;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/dav ────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status  = null,
        [FromQuery] string? origin  = null,
        [FromQuery] DateTime? from  = null,
        [FromQuery] DateTime? to    = null,
        [FromQuery] string? search  = null,
        [FromQuery] int page        = 1,
        [FromQuery] int pageSize    = 20,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);

        var q = _db.SalesQuotes
            .AsNoTracking()
            .Where(s => s.CompanyId == CompanyId);

        // Por padrão exclui arquivados; inclui apenas quando explicitamente solicitado
        if (!includeArchived)
            q = q.Where(s => !s.IsArchived);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<SalesQuoteStatus>(status, ignoreCase: true, out var parsedStatus))
            q = q.Where(s => s.Status == parsedStatus);

        if (!string.IsNullOrWhiteSpace(origin) &&
            Enum.TryParse<SalesQuoteOrigin>(origin, ignoreCase: true, out var parsedOrigin))
            q = q.Where(s => s.Origin == parsedOrigin);

        if (from.HasValue)  q = q.Where(s => s.CreatedAtUtc >= from.Value);
        if (to.HasValue)    q = q.Where(s => s.CreatedAtUtc <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(x =>
                x.PublicId.ToLower().Contains(s) ||
                x.CustomerName.ToLower().Contains(s) ||
                (x.CustomerPhone != null && x.CustomerPhone.Contains(s)));
        }

        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new SalesQuoteListItem(
                s.Id,
                s.PublicId,
                s.CustomerName,
                s.CustomerPhone,
                s.PaymentMethod,
                s.TotalCents,
                s.Status.ToString(),
                s.Origin.ToString(),
                s.OriginOrderId,
                s.Items.Count,
                s.CreatedAtUtc,
                s.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(new SalesQuoteListResponse(page, pageSize, total, items));
    }

    // ── GET /admin/dav/pending-fiscal ─────────────────────────────────────────
    /// <summary>Lista DAVs gerados de delivery aguardando confirmação fiscal.</summary>
    [HttpGet("pending-fiscal")]
    public async Task<IActionResult> PendingFiscal(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = _db.SalesQuotes
            .AsNoTracking()
            .Where(s => s.CompanyId == CompanyId &&
                        s.Status == SalesQuoteStatus.AwaitingFiscalConfirmation);

        var total = await q.CountAsync(ct);

        var items = await q
            .OrderBy(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new SalesQuoteListItem(
                s.Id,
                s.PublicId,
                s.CustomerName,
                s.CustomerPhone,
                s.PaymentMethod,
                s.TotalCents,
                s.Status.ToString(),
                s.Origin.ToString(),
                s.OriginOrderId,
                s.Items.Count,
                s.CreatedAtUtc,
                s.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(new SalesQuoteListResponse(page, pageSize, total, items));
    }

    // ── GET /admin/dav/{id} ───────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var q = await _db.SalesQuotes
            .AsNoTracking()
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (q is null) return NotFound("DAV não encontrado.");

        return Ok(ToDetailResponse(q));
    }

    // ── POST /admin/dav ───────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSalesQuoteRequest req,
        CancellationToken ct)
    {
        var items = await BuildItemsAsync(req.Items, ct);
        if (items is null) return BadRequest("Um ou mais produtos não foram encontrados.");

        var subtotal = items.Sum(i => i.TotalCents);
        var quote = new SalesQuote
        {
            CompanyId        = CompanyId,
            PublicId         = DavPublicIdGenerator.NewPublicId(),
            Origin           = SalesQuoteOrigin.Manual,
            CustomerName     = req.CustomerName,
            CustomerPhone    = req.CustomerPhone,
            CustomerDocument = req.CustomerDocument,
            PaymentMethod    = req.PaymentMethod,
            SubtotalCents    = subtotal,
            DiscountCents    = 0,
            TotalCents       = subtotal,
            Status           = SalesQuoteStatus.Draft,
            Notes            = req.Notes,
            Items            = items
        };

        _db.SalesQuotes.Add(quote);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = quote.Id }, new { quote.Id, quote.PublicId });
    }

    // ── PUT /admin/dav/{id} ───────────────────────────────────────────────────
    /// <summary>Atualiza dados do DAV (apenas status Draft).</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateSalesQuoteRequest req,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");

        if (quote.Status != SalesQuoteStatus.Draft)
            return Conflict($"DAV com status '{quote.Status}' não pode ser editado.");

        if (req.CustomerName  != null) quote.CustomerName     = req.CustomerName;
        if (req.CustomerPhone != null) quote.CustomerPhone    = req.CustomerPhone;
        if (req.CustomerDocument != null) quote.CustomerDocument = req.CustomerDocument;
        if (req.PaymentMethod != null) quote.PaymentMethod    = req.PaymentMethod;
        if (req.Notes         != null) quote.Notes            = req.Notes;

        if (req.DiscountCents.HasValue)
        {
            quote.DiscountCents = req.DiscountCents.Value;
            quote.TotalCents    = Math.Max(0, quote.SubtotalCents - quote.DiscountCents);
        }

        quote.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ToDetailResponse(quote));
    }

    // ── POST /admin/dav/{id}/items ────────────────────────────────────────────
    /// <summary>Adiciona item ao DAV (apenas status Draft).</summary>
    [HttpPost("{id:guid}/items")]
    public async Task<IActionResult> AddItem(
        Guid id,
        [FromBody] AddSalesQuoteItemRequest req,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");
        if (quote.Status != SalesQuoteStatus.Draft)
            return Conflict($"DAV com status '{quote.Status}' não permite adição de itens.");

        var product = await _db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == req.ProductId && p.CompanyId == CompanyId && p.IsActive, ct);

        if (product is null) return BadRequest("Produto não encontrado ou inativo.");

        int total;
        if (product.IsSoldByWeight)
        {
            if (req.WeightKg is null or <= 0)
                return BadRequest("WeightKg é obrigatório e deve ser > 0 para produtos por peso.");
            total = (int)Math.Round(req.WeightKg.Value * product.PriceCents);
        }
        else
        {
            total = (int)Math.Round(req.Qty * product.PriceCents);
        }

        var item = new SalesQuoteItem
        {
            ProductId              = product.Id,
            ProductNameSnapshot    = product.Name,
            ProductBarcodeSnapshot = product.Barcode,
            Qty                    = req.Qty,
            UnitPriceCentsSnapshot = product.PriceCents,
            TotalCents             = total,
            IsSoldByWeight         = product.IsSoldByWeight,
            WeightKg               = req.WeightKg
        };

        quote.Items.Add(item);
        RecalcTotals(quote);
        quote.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { item.Id });
    }

    // ── PUT /admin/dav/{id}/items/{itemId} ────────────────────────────────────
    [HttpPut("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> UpdateItem(
        Guid id,
        Guid itemId,
        [FromBody] UpdateSalesQuoteItemRequest req,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");
        if (quote.Status != SalesQuoteStatus.Draft)
            return Conflict($"DAV com status '{quote.Status}' não permite edição de itens.");

        var item = quote.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return NotFound("Item não encontrado.");

        if (item.IsSoldByWeight)
        {
            if (req.WeightKg is null or <= 0)
                return BadRequest("WeightKg é obrigatório para produtos por peso.");
            item.WeightKg  = req.WeightKg;
            item.Qty       = req.Qty;
            item.TotalCents = (int)Math.Round(req.WeightKg.Value * item.UnitPriceCentsSnapshot);
        }
        else
        {
            item.Qty       = req.Qty;
            item.TotalCents = (int)Math.Round(req.Qty * item.UnitPriceCentsSnapshot);
        }

        RecalcTotals(quote);
        quote.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /admin/dav/{id}/items/{itemId} ─────────────────────────────────
    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(
        Guid id,
        Guid itemId,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");
        if (quote.Status != SalesQuoteStatus.Draft)
            return Conflict($"DAV com status '{quote.Status}' não permite remoção de itens.");

        var item = quote.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null) return NotFound("Item não encontrado.");

        quote.Items.Remove(item);
        RecalcTotals(quote);
        quote.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /admin/dav/{id}/confirm-fiscal ───────────────────────────────────
    /// <summary>
    /// Confirma que a obrigação fiscal deste DAV foi tratada
    /// (NFC-e emitida externamente, dispensa aplicada, ou decisão registrada).
    /// Muda status de AwaitingFiscalConfirmation → FiscalConfirmed.
    /// </summary>
    [HttpPost("{id:guid}/confirm-fiscal")]
    public async Task<IActionResult> ConfirmFiscal(
        Guid id,
        [FromBody] ConfirmFiscalRequest req,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");

        if (quote.Status != SalesQuoteStatus.AwaitingFiscalConfirmation &&
            quote.Status != SalesQuoteStatus.Draft)
            return Conflict($"DAV com status '{quote.Status}' não pode ter fiscal confirmado.");

        if (req.Notes is not null) quote.Notes = req.Notes;

        quote.Status                 = SalesQuoteStatus.FiscalConfirmed;
        quote.FiscalConfirmedAtUtc   = DateTime.UtcNow;
        quote.UpdatedAtUtc           = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDetailResponse(quote));
    }

    // ── POST /admin/dav/{id}/cancel ───────────────────────────────────────────
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");

        if (quote.Status == SalesQuoteStatus.Converted)
            return Conflict("DAV já convertido para PDV não pode ser cancelado.");

        if (quote.Status == SalesQuoteStatus.Cancelled)
            return Conflict("DAV já está cancelado.");

        quote.Status       = SalesQuoteStatus.Cancelled;
        quote.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { quote.Id, quote.Status });
    }

    // ── POST /admin/dav/{id}/convert ─────────────────────────────────────────
    /// <summary>
    /// Converte o DAV em SaleOrder (stub PDV).
    /// Fase 3 irá preencher os campos completos do SaleOrder.
    /// Aceita status FiscalConfirmed ou Draft (venda direta sem NFC-e).
    /// </summary>
    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> ConvertToPdv(
        Guid id,
        [FromBody] ConvertToPdvRequest req,
        CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound("DAV não encontrado.");

        if (quote.Status == SalesQuoteStatus.Converted)
            return Conflict("DAV já foi convertido.");

        if (quote.Status == SalesQuoteStatus.Cancelled)
            return Conflict("DAV cancelado não pode ser convertido.");

        if (req.Notes is not null) quote.Notes = req.Notes;

        var saleOrder = new SaleOrder
        {
            CompanyId     = CompanyId,
            PublicId      = $"PDV-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(0, 999999):D6}",
            SalesQuoteId  = quote.Id,
            CreatedAtUtc  = DateTime.UtcNow
        };

        _db.SaleOrders.Add(saleOrder);

        quote.SaleOrderId    = saleOrder.Id;
        quote.Status         = SalesQuoteStatus.Converted;
        quote.ConvertedAtUtc = DateTime.UtcNow;
        quote.UpdatedAtUtc   = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new { quote.Id, SaleOrderId = saleOrder.Id, saleOrder.PublicId });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<List<SalesQuoteItem>?> BuildItemsAsync(
        IReadOnlyList<CreateSalesQuoteItemRequest>? reqs,
        CancellationToken ct)
    {
        if (reqs is null || reqs.Count == 0) return new List<SalesQuoteItem>();

        var productIds = reqs.Select(r => r.ProductId).Distinct().ToList();
        var products   = await _db.Products
            .AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == CompanyId && p.IsActive)
            .ToDictionaryAsync(p => p.Id, ct);

        if (products.Count != productIds.Count) return null;

        return reqs.Select(r =>
        {
            var p     = products[r.ProductId];
            int total = p.IsSoldByWeight && r.WeightKg is > 0
                ? (int)Math.Round(r.WeightKg.Value * p.PriceCents)
                : (int)Math.Round(r.Qty * p.PriceCents);

            return new SalesQuoteItem
            {
                ProductId              = p.Id,
                ProductNameSnapshot    = p.Name,
                ProductBarcodeSnapshot = p.Barcode,
                Qty                    = r.Qty,
                UnitPriceCentsSnapshot = p.PriceCents,
                TotalCents             = total,
                IsSoldByWeight         = p.IsSoldByWeight,
                WeightKg               = p.IsSoldByWeight ? r.WeightKg : null
            };
        }).ToList();
    }

    private static void RecalcTotals(SalesQuote quote)
    {
        quote.SubtotalCents = quote.Items.Sum(i => i.TotalCents);
        quote.TotalCents    = Math.Max(0, quote.SubtotalCents - quote.DiscountCents);
    }

    private static SalesQuoteDetailResponse ToDetailResponse(SalesQuote q) =>
        new(q.Id, q.PublicId, q.CompanyId,
            q.CustomerName, q.CustomerPhone, q.CustomerDocument,
            q.PaymentMethod,
            q.SubtotalCents, q.DiscountCents, q.TotalCents,
            q.Status.ToString(), q.Origin.ToString(),
            q.OriginOrderId, q.FiscalDocumentId, q.SaleOrderId,
            q.Notes,
            q.CreatedAtUtc, q.UpdatedAtUtc, q.FiscalConfirmedAtUtc, q.ConvertedAtUtc,
            q.Items.Select(i => new SalesQuoteItemDto(
                i.Id, i.ProductId, i.ProductNameSnapshot, i.ProductBarcodeSnapshot,
                i.Qty, i.UnitPriceCentsSnapshot, i.TotalCents,
                i.IsSoldByWeight, i.WeightKg)).ToList());


    // -- GET /admin/dav/abandoned ------------------------------------------------
    /// <summary>
    /// Lista DAVs em aberto (Draft) sem movimentacao por mais de N horas.
    /// Util para identificar orcamentos abandonados antes do arquivamento.
    /// </summary>
    [HttpGet("abandoned")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> ListAbandoned(
        [FromQuery] int olderThanHours = 24,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);
        var cutoff = DateTime.UtcNow.AddHours(-Math.Abs(olderThanHours));

        var q = _db.SalesQuotes
            .AsNoTracking()
            .Where(s => s.CompanyId == CompanyId
                     && !s.IsArchived
                     && s.Status == SalesQuoteStatus.Draft
                     && s.SaleOrderId == null
                     && s.FiscalDocumentId == null
                     && s.CreatedAtUtc < cutoff);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.PublicId,
                s.CustomerName,
                s.TotalCents,
                Status = s.Status.ToString(),
                s.CreatedAtUtc,
                AgeHours = (int)(DateTime.UtcNow - s.CreatedAtUtc).TotalHours,
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, olderThanHours, items });
    }

    // -- POST /admin/dav/archive-abandoned ---------------------------------------
    /// <summary>
    /// Arquiva em lote os DAVs em Draft sem movimentacao por mais de N horas.
    /// Apenas arquivamento seguro: nao afeta DAVs com fiscal ou convertidos.
    /// </summary>
    [HttpPost("archive-abandoned")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> ArchiveAbandoned(
        [FromBody] ArchiveAbandonedRequest req,
        CancellationToken ct)
    {
        var olderThanHours = req.OlderThanHours < 1 ? 24 : req.OlderThanHours;
        var cutoff = DateTime.UtcNow.AddHours(-olderThanHours);
        var now = DateTime.UtcNow;

        var toArchive = await _db.SalesQuotes
            .Where(s => s.CompanyId == CompanyId
                     && !s.IsArchived
                     && s.Status == SalesQuoteStatus.Draft
                     && s.SaleOrderId == null
                     && s.FiscalDocumentId == null
                     && s.CreatedAtUtc < cutoff)
            .ToListAsync(ct);

        foreach (var q in toArchive)
        {
            q.IsArchived    = true;
            q.ArchivedAtUtc = now;
            q.UpdatedAtUtc  = now;
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new { archived = toArchive.Count, cutoff, olderThanHours });
    }

    // -- POST /admin/dav/{id}/archive --------------------------------------------
    /// <summary>
    /// Arquiva um DAV individual. Seguro apenas para Draft sem fiscal.
    /// </summary>
    [HttpPost("{id:guid}/archive")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> ArchiveOne(Guid id, CancellationToken ct)
    {
        var quote = await _db.SalesQuotes
            .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == CompanyId, ct);

        if (quote is null) return NotFound();

        if (quote.Status == SalesQuoteStatus.Converted)
            return Conflict("DAV ja convertido em venda — nao pode ser arquivado.");

        if (quote.FiscalDocumentId.HasValue)
            return Conflict("DAV possui documento fiscal vinculado — nao pode ser arquivado.");

        if (quote.IsArchived)
            return Ok(new { message = "Ja estava arquivado.", id });

        quote.IsArchived    = true;
        quote.ArchivedAtUtc = DateTime.UtcNow;
        quote.UpdatedAtUtc  = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { archived = true, id, quote.PublicId });
    }

    // -- POST /admin/dav/purge-archived ------------------------------------------
    /// <summary>
    /// Delecao fisica de DAVs arquivados ha mais de N dias.
    /// Seguro: apenas DAVs sem fiscal e sem SaleOrder vinculada.
    /// </summary>
    [HttpPost("purge-archived")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> PurgeArchived(
        [FromBody] PurgeArchivedRequest req,
        CancellationToken ct)
    {
        var olderThanDays = req.OlderThanDays < 1 ? 30 : req.OlderThanDays;
        var cutoff = DateTime.UtcNow.AddDays(-olderThanDays);

        var toPurge = await _db.SalesQuotes
            .Where(s => s.CompanyId == CompanyId
                     && s.IsArchived
                     && s.ArchivedAtUtc < cutoff
                     && s.SaleOrderId == null
                     && s.FiscalDocumentId == null)
            .ToListAsync(ct);

        _db.SalesQuotes.RemoveRange(toPurge);
        await _db.SaveChangesAsync(ct);

        return Ok(new { purged = toPurge.Count, cutoff, olderThanDays });
    }
}


public record ArchiveAbandonedRequest(int OlderThanHours = 24);
public record PurgeArchivedRequest(int OlderThanDays = 30);
