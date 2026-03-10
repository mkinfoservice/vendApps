using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Orders;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Services;
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

    public AdminOrdersController(AppDbContext db, ILogger<AdminOrdersController> logger, IBackgroundJobClient jobs, PrintService print)
    {
        _db = db;
        _logger = logger;
        _jobs = jobs;
        _print = print;
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
        if (string.IsNullOrWhiteSpace(req.CustomerPhone))
            return BadRequest(new { error = "Telefone é obrigatório." });

        // ── Resolve CustomerId opcional ────────────────────────────────────────
        Customer? customer = null;
        if (req.CustomerId.HasValue)
        {
            customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == req.CustomerId.Value && c.CompanyId == CompanyId, ct);
            // Não bloquear se não encontrar — pode ter sido deletado entre a busca e o confirm
        }

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
        var order = new Order
        {
            Id             = Guid.NewGuid(),
            PublicId       = OrderIdGenerator.NewPublicId(),
            CompanyId      = CompanyId,
            CustomerId     = customer?.Id,
            IsPhoneOrder   = true,
            AttendantUserId = attendantId,

            CustomerName = req.CustomerName.Trim(),
            Phone        = req.CustomerPhone.Trim(),
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

            order.Items.Add(new OrderItem
            {
                Id                    = Guid.NewGuid(),
                ProductId             = product.Id,
                ProductNameSnapshot   = product.Name,
                UnitPriceCentsSnapshot = product.PriceCents,
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
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "📞 Pedido telefônico {PublicId} criado pelo atendente {Attendant} | Cliente: {Customer} | Total: {Total}",
            order.PublicId, attendantId, order.CustomerName, order.TotalCents);

        // Fila de impressão — fire-and-forget (não falha o pedido se SignalR offline)
        _ = Task.Run(() => _print.EnqueueAsync(order));

        // Notificação WhatsApp — fire-and-forget
        _jobs.Enqueue<WhatsAppNotificationService>(
            s => s.NotifyOrderStatusAsync(order.Id, OrderStatus.RECEBIDO, CancellationToken.None));

        return Ok(new CreateOrderResponse
        {
            Id             = order.Id,
            OrderNumber    = order.PublicId,
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

    public string CustomerPhone { get; init; } = "";

    /// <summary>Endereço de entrega — se omitido e CustomerId informado, usa endereço do cadastro.</summary>
    public string? Cep { get; init; }
    public string? Address { get; init; }
    public string? Complement { get; init; }

    public List<PhoneOrderItemRequest> Items { get; init; } = new();

    public string? PaymentMethod { get; init; } = "PIX";

    /// <summary>Taxa de entrega em centavos (opcional, padrão 0 para pedidos telefônicos).</summary>
    public int? DeliveryCents { get; init; }

    /// <summary>Quanto o cliente vai pagar em dinheiro (somente se PaymentMethod = CASH).</summary>
    public int? CashGivenCents { get; init; }
}

public sealed class PhoneOrderItemRequest
{
    public Guid ProductId { get; init; }
    public int Qty { get; init; }
}
