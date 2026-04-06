using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Orders;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Dav;
using Petshop.Api.Services;
using Petshop.Api.Services.Customers;
using Petshop.Api.Services.Dav;
using Petshop.Api.Services.Print;
using Petshop.Api.Services.WhatsApp;
using Hangfire;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoints de gestão de pedidos do lado admin (phone orders, reimpressão, etc.).
/// Rota base: /admin/orders
/// </summary>
[ApiController]
[Route("admin/orders")]
[Authorize(Roles = "admin,gerente,atendente")]
public class AdminOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AdminOrdersController> _logger;
    private readonly IBackgroundJobClient _jobs;
    private readonly PrintService _print;
    private readonly LoyaltyService _loyalty;

    public AdminOrdersController(AppDbContext db, ILogger<AdminOrdersController> logger, IBackgroundJobClient jobs, PrintService print, LoyaltyService loyalty)
    {
        _db = db;
        _logger = logger;
        _jobs = jobs;
        _print = print;
        _loyalty = loyalty;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── POST /admin/orders/phone ──────────────────────────────────────────────
    /// <summary>
    /// Cria um pedido telefônico. O orçamento foi aprovado pelo cliente — gera o pedido real.
    /// </summary>
    [HttpPost("phone")]
    public async Task<ActionResult<CreateOrderResponse>> CreatePhoneOrder(
        [FromBody] CreatePhoneOrderRequest req,
        CancellationToken ct = default)
    {
        // ── Validações básicas ────────────────────────────────────────────────
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "Carrinho vazio." });
        if (string.IsNullOrWhiteSpace(req.CustomerName))
            return BadRequest(new { error = "Nome do cliente é obrigatório." });

        // ── Resolve CustomerId opcional ────────────────────────────────────────
        Customer? customer = null;
        if (req.CustomerId.HasValue)
        {
            customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == req.CustomerId.Value && c.CompanyId == CompanyId, ct);
            // Não bloquear se não encontrar — pode ter sido deletado entre a busca e o confirm
        }

        var normalizedCpfConfirmation = CpfValidator.Normalize(req.CustomerCpfConfirmation);

        // ── Determina o AttendantUserId a partir do JWT ───────────────────────
        // O claim "sub" contém o username; busca o Id real do AdminUser.
        Guid? attendantId = null;
        var username = User.FindFirstValue(ClaimTypes.Name)
                    ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (username is not null)
        {
            var adminUser = await _db.AdminUsers
                .AsNoTracking()
                .Where(u => u.Username == username && u.CompanyId == CompanyId)
                .Select(u => new { u.Id })
                .FirstOrDefaultAsync(ct);
            attendantId = adminUser?.Id;
        }

        // ── Monta o pedido ────────────────────────────────────────────────────
        var normalizedPhone = System.Text.RegularExpressions.Regex.Replace(
            req.CustomerPhone ?? customer?.Phone ?? "", @"\D", "");

        var order = new Order
        {
            Id             = Guid.NewGuid(),
            PublicId       = OrderIdGenerator.NewPublicId(),
            CompanyId      = CompanyId,
            CustomerId     = customer?.Id,
            IsPhoneOrder   = true,
            AttendantUserId = attendantId,

            CustomerName = req.CustomerName.Trim(),
            Phone        = normalizedPhone,
            Cep          = req.Cep?.Trim() ?? customer?.Cep ?? "",
            Address      = req.Address?.Trim() ?? customer?.Address ?? "",
            Complement   = req.Complement?.Trim() ?? customer?.Complement,

            // Coordenadas do customer (já geocodificadas) se disponíveis
            Latitude  = customer?.Latitude,
            Longitude = customer?.Longitude,
            GeocodedAtUtc  = customer?.GeocodedAtUtc,
            GeocodeProvider = customer is not null && customer.GeocodedAtUtc.HasValue ? "customer" : null,

            PaymentMethod = (req.PaymentMethod ?? "PIX").Trim().ToUpperInvariant(),
            Status = OrderStatus.RECEBIDO,
            CreatedAtUtc = DateTime.UtcNow,
            OriginChannel = "phone",
        };

        // ── Itens do carrinho ──────────────────────────────────────────────────
        foreach (var item in req.Items)
        {
            if (item.Qty <= 0)
                return BadRequest(new { error = "Quantidade inválida." });

            var product = await _db.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.CompanyId == CompanyId, ct);

            if (product is null)
                return BadRequest(new { error = $"Produto não encontrado: {item.ProductId}" });

            var requestedAddonIds = (item.AddonIds ?? new List<Guid>())
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            var selectedAddons = requestedAddonIds.Count == 0
                ? new List<Entities.Catalog.ProductAddon>()
                : await _db.ProductAddons
                    .Where(a => a.ProductId == product.Id && a.IsActive && requestedAddonIds.Contains(a.Id))
                    .ToListAsync(ct);

            if (selectedAddons.Count != requestedAddonIds.Count)
                return BadRequest(new { error = $"Adicionais inválidos para o produto {product.Name}." });

            var addonsTotalCents = selectedAddons.Sum(a => a.PriceCents);
            var snapshotSuffix = selectedAddons.Count == 0
                ? ""
                : $" (+ {string.Join(", ", selectedAddons.Select(a => a.Name))})";
            var snapshotName = $"{product.Name}{snapshotSuffix}";
            if (snapshotName.Length > 150)
                snapshotName = snapshotName[..150];

            order.Items.Add(new OrderItem
            {
                Id                    = Guid.NewGuid(),
                ProductId             = product.Id,
                ProductNameSnapshot   = snapshotName,
                UnitPriceCentsSnapshot = product.PriceCents + addonsTotalCents,
                Qty                   = item.Qty,
            });
        }

        // ── Totais ────────────────────────────────────────────────────────────
        order.SubtotalCents  = order.Items.Sum(i => i.UnitPriceCentsSnapshot * i.Qty);
        order.DeliveryCents  = req.DeliveryCents ?? 0;    // atendente pode informar ou 0
        order.TotalCents     = order.SubtotalCents + order.DeliveryCents;

        // ── Troco ──────────────────────────────────────────────────────────────
        if (order.PaymentMethod == "CASH")
        {
            if (req.CashGivenCents is null)
                return BadRequest(new { error = "CashGivenCents é obrigatório quando pagamento = CASH." });
            if (req.CashGivenCents.Value < order.TotalCents)
                return BadRequest(new { error = "Valor em dinheiro insuficiente para o total do pedido." });

            order.CashGivenCents = req.CashGivenCents.Value;
            order.ChangeCents    = req.CashGivenCents.Value - order.TotalCents;
        }

        _db.Orders.Add(order);

        // ── Gera DAV para o caixa importar ────────────────────────────────────
        var dav = new SalesQuote
        {
            CompanyId     = CompanyId,
            PublicId      = DavPublicIdGenerator.NewPublicId(),
            Origin        = SalesQuoteOrigin.PhoneOrder,
            OriginOrderId = order.Id,
            CustomerName  = order.CustomerName,
            CustomerPhone = order.Phone,
            PaymentMethod = order.PaymentMethod,
            SubtotalCents = order.SubtotalCents,
            TotalCents    = order.TotalCents,
            Notes         = $"Pedido telefônico {order.PublicId}",
            Items         = order.Items.Select(i => new SalesQuoteItem
            {
                ProductId              = i.ProductId,
                ProductNameSnapshot    = i.ProductNameSnapshot,
                Qty                    = i.Qty,
                UnitPriceCentsSnapshot = i.UnitPriceCentsSnapshot,
                TotalCents             = i.UnitPriceCentsSnapshot * i.Qty,
            }).ToList(),
        };
        _db.SalesQuotes.Add(dav);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "📞 Pedido telefônico {PublicId} criado pelo atendente {Attendant} | Cliente: {Customer} | Total: {Total} | DAV: {DavId}",
            order.PublicId, attendantId, order.CustomerName, order.TotalCents, dav.PublicId);

        // Fila de impressão
        await _print.EnqueueAsync(order, ct);

        // Notificação WhatsApp — fire-and-forget
        _jobs.Enqueue<WhatsAppNotificationService>(
            s => s.NotifyOrderStatusAsync(order.Id, OrderStatus.RECEBIDO, CancellationToken.None));

        // Fidelidade — acumula pontos imediatamente para pedidos telefônicos com cliente cadastrado
        if (customer is not null && CanAccumulateLoyalty(customer, normalizedCpfConfirmation))
            _jobs.Enqueue<LoyaltyService>(
                s => s.EarnForOrderAsync(order.Id, CancellationToken.None));

        return Ok(new CreateOrderResponse
        {
            Id             = order.Id,
            OrderNumber    = order.PublicId,
            DavPublicId    = dav.PublicId,
            Status         = order.Status.ToString(),
            SubtotalCents  = order.SubtotalCents,
            DeliveryCents  = order.DeliveryCents,
            TotalCents     = order.TotalCents,
            PaymentMethodStr = order.PaymentMethod,
            CashGivenCents = order.CashGivenCents,
            ChangeCents    = order.ChangeCents,
        });
    }

    // ── PATCH /admin/orders/{id}/retrograde ───────────────────────────────────
    /// <summary>
    /// Permite que admin/gerente retrogradem o status de um pedido (exceto CANCELADO).
    /// Atendentes não têm acesso a este endpoint.
    /// </summary>
    [HttpPatch("{idOrNumber}/retrograde")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> Retrograde(
        string idOrNumber,
        [FromBody] RetrogradeOrderRequest req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Status))
            return BadRequest(new { error = "Status é obrigatório." });

        if (!Enum.TryParse<OrderStatus>(req.Status.Trim(), ignoreCase: true, out var newStatus))
            return BadRequest(new { error = $"Status inválido: {req.Status}" });

        Order? order;
        if (Guid.TryParse(idOrNumber, out var id))
            order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == CompanyId, ct);
        else
            order = await _db.Orders.FirstOrDefaultAsync(o => o.PublicId == idOrNumber && o.CompanyId == CompanyId, ct);

        if (order is null) return NotFound(new { error = "Pedido não encontrado." });
        if (order.Status == OrderStatus.CANCELADO) return BadRequest(new { error = "Não é possível alterar pedidos cancelados." });
        if (newStatus == OrderStatus.CANCELADO) return BadRequest(new { error = "Use o endpoint padrão para cancelar pedidos." });

        var oldStatus = order.Status;
        order.Status = newStatus;
        order.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "↩️ Retrocesso de status | Pedido={PublicId} | {Old} → {New}",
            order.PublicId, oldStatus, newStatus);

        return Ok(new { orderId = order.Id, publicId = order.PublicId, oldStatus = oldStatus.ToString(), newStatus = newStatus.ToString() });
    }

    // ── DELETE /admin/orders/deliveries ───────────────────────────────────────
    /// <summary>
    /// Limpa todos os registros de entregas/pedidos da empresa atual, independente do status.
    /// Restrito ao perfil admin para uso em ambiente de testes/mostruário.
    /// </summary>
    [HttpDelete("deliveries")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteAllDeliveries(CancellationToken ct = default)
    {
        // Captura os IDs de rotas que pertencem aos pedidos da empresa,
        // para remover apenas rotas órfãs dessa limpeza.
        var routeIds = await _db.RouteStops
            .Where(rs => _db.Orders.Any(o => o.Id == rs.OrderId && o.CompanyId == CompanyId))
            .Select(rs => rs.RouteId)
            .Distinct()
            .ToListAsync(ct);

        var routeStopsToDelete = await _db.RouteStops
            .CountAsync(rs => _db.Orders.Any(o => o.Id == rs.OrderId && o.CompanyId == CompanyId), ct);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // DAVs automáticos de delivery (OriginOrderId) não são necessários após purge.
        var deletedDeliveryDavs = await _db.SalesQuotes
            .Where(q => q.CompanyId == CompanyId &&
                        q.OriginOrderId.HasValue &&
                        _db.Orders.Any(o => o.Id == q.OriginOrderId.Value && o.CompanyId == CompanyId))
            .ExecuteDeleteAsync(ct);

        var deletedOrders = await _db.Orders
            .Where(o => o.CompanyId == CompanyId)
            .ExecuteDeleteAsync(ct);

        var deletedRoutes = 0;
        if (routeIds.Count > 0)
        {
            deletedRoutes = await _db.Routes
                .Where(r => routeIds.Contains(r.Id) && !r.Stops.Any())
                .ExecuteDeleteAsync(ct);
        }

        await tx.CommitAsync(ct);

        _logger.LogWarning(
            "🧹 PURGE_DELIVERIES | CompanyId={CompanyId} | Orders={Orders} | RouteStops={RouteStops} | Routes={Routes} | DeliveryDavs={DeliveryDavs}",
            CompanyId, deletedOrders, routeStopsToDelete, deletedRoutes, deletedDeliveryDavs);

        return Ok(new
        {
            deletedOrders,
            deletedRouteStops = routeStopsToDelete,
            deletedRoutes,
            deletedDeliveryDavs
        });
    }

    // ── DELETE /admin/orders/deliveries/finalized ─────────────────────────────
    /// <summary>
    /// Limpa apenas entregas já encerradas (Status = ENTREGUE ou CANCELADO).
    /// Restrito ao perfil admin.
    /// </summary>
    [HttpDelete("deliveries/finalized")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteFinalizedDeliveries(CancellationToken ct = default)
    {
        var deliveredOrderIdsQuery = _db.Orders
            .Where(o => o.CompanyId == CompanyId &&
                        (o.Status == OrderStatus.ENTREGUE || o.Status == OrderStatus.CANCELADO))
            .Select(o => o.Id);

        var deliveredOrdersCount = await deliveredOrderIdsQuery.CountAsync(ct);
        if (deliveredOrdersCount == 0)
        {
            return Ok(new
            {
                deletedOrders = 0,
                deletedRouteStops = 0,
                deletedRoutes = 0,
                deletedDeliveryDavs = 0
            });
        }

        var routeIds = await _db.RouteStops
            .Where(rs => deliveredOrderIdsQuery.Contains(rs.OrderId))
            .Select(rs => rs.RouteId)
            .Distinct()
            .ToListAsync(ct);

        var routeStopsToDelete = await _db.RouteStops
            .CountAsync(rs => deliveredOrderIdsQuery.Contains(rs.OrderId), ct);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var deletedDeliveryDavs = await _db.SalesQuotes
            .Where(q => q.CompanyId == CompanyId &&
                        q.OriginOrderId.HasValue &&
                        deliveredOrderIdsQuery.Contains(q.OriginOrderId.Value))
            .ExecuteDeleteAsync(ct);

        var deletedOrders = await _db.Orders
            .Where(o => o.CompanyId == CompanyId &&
                        (o.Status == OrderStatus.ENTREGUE || o.Status == OrderStatus.CANCELADO))
            .ExecuteDeleteAsync(ct);

        var deletedRoutes = 0;
        if (routeIds.Count > 0)
        {
            deletedRoutes = await _db.Routes
                .Where(r => routeIds.Contains(r.Id) && !r.Stops.Any())
                .ExecuteDeleteAsync(ct);
        }

        await tx.CommitAsync(ct);

        _logger.LogWarning(
            "🧹 PURGE_DELIVERIES_CLOSED | CompanyId={CompanyId} | Orders={Orders} | RouteStops={RouteStops} | Routes={Routes} | DeliveryDavs={DeliveryDavs}",
            CompanyId, deletedOrders, routeStopsToDelete, deletedRoutes, deletedDeliveryDavs);

        return Ok(new
        {
            deletedOrders,
            deletedRouteStops = routeStopsToDelete,
            deletedRoutes,
            deletedDeliveryDavs
        });
    }

    private static bool CanAccumulateLoyalty(Customer customer, string? cpfConfirmation)
    {
        if (string.IsNullOrWhiteSpace(customer.Cpf))
            return true;

        if (!CpfValidator.IsValid(cpfConfirmation))
            return false;

        return string.Equals(customer.Cpf, cpfConfirmation, StringComparison.Ordinal);
    }
}

public sealed class RetrogradeOrderRequest
{
    public string Status { get; init; } = "";
}

// ── Request DTO ───────────────────────────────────────────────────────────────

public sealed class CreatePhoneOrderRequest
{
    /// <summary>ID do cliente cadastrado (opcional — pode vir do search).</summary>
    public Guid? CustomerId { get; init; }

    /// <summary>Nome do cliente — obrigatório mesmo com CustomerId (confirmação visual).</summary>
    public string CustomerName { get; init; } = "";

    public string? CustomerPhone { get; init; }

    /// <summary>Endereço de entrega — se omitido e CustomerId informado, usa endereço do cadastro.</summary>
    public string? Cep { get; init; }
    public string? Address { get; init; }
    public string? Complement { get; init; }

    public List<PhoneOrderItemRequest> Items { get; init; } = new();

    public string? PaymentMethod { get; init; } = "PIX";
    public string? CustomerCpfConfirmation { get; init; }

    /// <summary>Taxa de entrega em centavos (opcional, padrão 0 para pedidos telefônicos).</summary>
    public int? DeliveryCents { get; init; }

    /// <summary>Quanto o cliente vai pagar em dinheiro (somente se PaymentMethod = CASH).</summary>
    public int? CashGivenCents { get; init; }
}

public sealed class PhoneOrderItemRequest
{
    public Guid ProductId { get; init; }
    public int Qty { get; init; }
    public List<Guid>? AddonIds { get; init; }
}
