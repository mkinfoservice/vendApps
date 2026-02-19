using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.Orders;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Services;
using Petshop.Api.Services.Geocoding;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("orders")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IGeocodingService _geo;
    private readonly ViaCepService _viaCep;
    private readonly IConfiguration _config;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(AppDbContext db, IGeocodingService geo, ViaCepService viaCep, IConfiguration config, ILogger<OrdersController> logger)
    {
        _db = db;
        _geo = geo;
        _viaCep = viaCep;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Enriquece o endereço usando ViaCEP antes de geocodificar.
    /// CEP → ViaCEP → logradouro + bairro + cidade → query precisa.
    /// </summary>
    private async Task<string> BuildGeocodingQueryAsync(Order order, CancellationToken ct)
    {
        var viaCep = await _viaCep.GetAddressAsync(order.Cep, ct);

        if (viaCep != null && !string.IsNullOrWhiteSpace(viaCep.Logradouro))
        {
            // Extrair número da casa do endereço original (ex: "Nº 2105", "N 115", "nº115")
            var numMatch = Regex.Match(order.Address ?? "", @"[Nn]\.?º?\s*(\d+)");
            var houseNumber = numMatch.Success ? numMatch.Groups[1].Value : "";

            var parts = new List<string> { viaCep.Logradouro };
            if (!string.IsNullOrEmpty(houseNumber)) parts.Add(houseNumber);
            if (!string.IsNullOrEmpty(viaCep.Bairro)) parts.Add(viaCep.Bairro);
            parts.Add(viaCep.Localidade ?? "Rio de Janeiro");
            parts.Add(viaCep.Uf ?? "RJ");
            parts.Add("Brasil");

            var enriched = string.Join(", ", parts);

            _logger.LogInformation(
                "📮 VIACEP ENRICHED | Pedido={OrderId} | Original=\"{Original}\" | Enriched=\"{Enriched}\"",
                order.PublicId, order.Address, enriched);

            return enriched;
        }

        // Fallback: formato original se ViaCEP falhar
        var fallback = $"{order.Address}, {order.Cep}, Rio de Janeiro, RJ, Brasil";
        _logger.LogWarning(
            "📮 VIACEP FALLBACK | Pedido={OrderId} | ViaCEP falhou, usando formato original: \"{Query}\"",
            order.PublicId, fallback);

        return fallback;
    }

    // =========================
    // GET /orders/{idOrNumber}
    // =========================
    [Authorize(Roles = "admin")]
    [HttpGet("{idOrNumber}")]
    public async Task<IActionResult> GetByIdOrNumber([FromRoute] string idOrNumber)
    {
        var baseQuery = _db.Orders
            .AsNoTracking()
            .Include(o => o.Items);

        Order? order;

        if (Guid.TryParse(idOrNumber, out var id))
            order = await baseQuery.FirstOrDefaultAsync(o => o.Id == id);
        else
            order = await baseQuery.FirstOrDefaultAsync(o => o.PublicId == idOrNumber);

        if (order is null)
            return NotFound("Pedido não encontrado.");

        var res = new GetOrderResponse
        {
            Id = order.Id,
            OrderNumber = order.PublicId,
            Status = order.Status.ToString(),

            Name = order.CustomerName,
            Phone = order.Phone,
            Cep = order.Cep,
            Address = order.Address,

            SubtotalCents = order.SubtotalCents,
            DeliveryCents = order.DeliveryCents,
            TotalCents = order.TotalCents,

            PaymentMethodStr = order.PaymentMethod,
            CashGivenCents = order.CashGivenCents,
            ChangeCents = order.ChangeCents,
            Coupon = order.Coupon,

            CreatedAtUtc = order.CreatedAtUtc,

            Items = order.Items.Select(i => new GetOrderItemResponse
            {
                ProductId = i.ProductId,
                ProductName = i.ProductNameSnapshot,
                UnitPriceCents = i.UnitPriceCentsSnapshot,
                Qty = i.Qty,
                TotalPriceCents = i.UnitPriceCentsSnapshot * i.Qty
            }).ToList()
        };

        return Ok(res);
    }

    // =========================
    // GET /orders/ready-for-delivery
    // =========================
    [Authorize(Roles = "admin")]
    [HttpGet("ready-for-delivery")]
    public async Task<ActionResult<ListReadyOrdersResponse>> ListReadyForDelivery(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        CancellationToken ct = default
    )
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var q = _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == OrderStatus.PRONTO_PARA_ENTREGA);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            q = q.Where(o => o.PublicId.Contains(term));
        }

        q = q.OrderBy(o => o.CreatedAtUtc);

        var total = await q.CountAsync(ct);

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new ReadyOrderItemResponse(
                o.Id,
                o.PublicId,
                o.CustomerName,
                o.Phone,
                o.Cep,
                o.Address,
                o.TotalCents,
                o.CreatedAtUtc,
                o.Latitude,
                o.Longitude
            ))
            .ToListAsync(ct);

        return Ok(new ListReadyOrdersResponse(total, items));
    }

    // =========================
    // GET /orders (admin list)
    // =========================
    [Authorize(Roles = "admin")]
    [HttpGet]
    public async Task<ActionResult<ListOrdersResponse>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default
    )
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _db.Orders.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var raw = status.Trim();
            if (!Enum.TryParse<OrderStatus>(raw, ignoreCase: true, out var parsed))
                return BadRequest("Status inválido.");

            query = query.Where(o => o.Status == parsed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(o => o.PublicId.Contains(term));
        }

        query = query.OrderByDescending(o => o.CreatedAtUtc);

        var total = await query.CountAsync(ct);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListItemResponse(
                o.Id,
                o.PublicId,
                o.CustomerName,
                o.Phone,
                o.Status.ToString(),
                o.TotalCents,
                o.PaymentMethod,
                o.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new ListOrdersResponse(page, pageSize, total, items));
    }

    // =========================
    // PATCH /orders/{idOrNumber}/status
    // =========================
    [Authorize(Roles = "admin")]
    [HttpPatch("{idOrNumber}/status")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(UpdateOrderStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(string), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(string), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(
        [FromRoute] string idOrNumber,
        [FromBody] UpdateOrderStatusRequest req,
        CancellationToken ct = default
    )
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Status))
            return BadRequest("Status é obrigatório.");

        Order? order;

        if (Guid.TryParse(idOrNumber, out var id))
            order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
        else
            order = await _db.Orders.FirstOrDefaultAsync(o => o.PublicId == idOrNumber, ct);

        if (order is null)
            return NotFound("Pedido não encontrado.");

        var raw = req.Status.Trim();

        if (!Enum.TryParse<OrderStatus>(raw, ignoreCase: true, out var newStatus))
            return BadRequest($"Status inválido: {raw}");

        var oldStatus = order.Status;

        if (!IsValidTransition(oldStatus, newStatus))
            return BadRequest($"Transição inválida: {oldStatus} → {newStatus}.");

        // ✅ PASSO 5: ao marcar PRONTO_PARA_ENTREGA, tenta geocoding (sem travar o fluxo se falhar)
        if (newStatus == OrderStatus.PRONTO_PARA_ENTREGA)
        {
            var needsGeo = order.Latitude is null || order.Longitude is null;

            if (needsGeo)
            {
                var providerName = (_config["Geocoding:Provider"] ?? "NOMINATIM").ToUpperInvariant();

                // ✅ Validação do endereço ANTES de geocodificar
                var hasAddress = !string.IsNullOrWhiteSpace(order.Address);
                var hasCep = !string.IsNullOrWhiteSpace(order.Cep);
                var cepIsValid = hasCep && order.Cep.Replace("-", "").Length == 8;

                _logger.LogInformation(
                    "📍 GEOCODING START | Pedido={OrderId} | Provider={Provider} | HasAddress={HasAddress} | HasCep={HasCep} | CepValid={CepValid}",
                    order.PublicId, providerName, hasAddress, hasCep, cepIsValid);

                if (!hasAddress || !hasCep)
                {
                    _logger.LogWarning(
                        "⚠️ GEOCODING SKIPPED | Pedido={OrderId} | Motivo: Endereço ou CEP ausente | Address=\"{Address}\" | Cep=\"{Cep}\"",
                        order.PublicId, order.Address ?? "(null)", order.Cep ?? "(null)");

                    order.GeocodedAtUtc = DateTime.UtcNow;
                    order.GeocodeProvider = $"{providerName} (incomplete_address)";
                }
                else if (!cepIsValid)
                {
                    _logger.LogWarning(
                        "⚠️ GEOCODING SKIPPED | Pedido={OrderId} | Motivo: CEP inválido | Cep=\"{Cep}\" (esperado 8 dígitos)",
                        order.PublicId, order.Cep);

                    order.GeocodedAtUtc = DateTime.UtcNow;
                    order.GeocodeProvider = $"{providerName} (invalid_cep)";
                }
                else
                {
                    var queryAddress = await BuildGeocodingQueryAsync(order, ct);

                    _logger.LogInformation(
                        "🌍 GEOCODING CALL | Pedido={OrderId} | Provider={Provider} | Query=\"{Query}\"",
                        order.PublicId, providerName, queryAddress);

                    try
                    {
                        var coords = await _geo.GeocodeAsync(queryAddress, ct);

                        if (coords is not null)
                        {
                            order.Latitude = coords.Value.lat;
                            order.Longitude = coords.Value.lon;
                            order.GeocodedAtUtc = DateTime.UtcNow;
                            order.GeocodeProvider = providerName;

                            _logger.LogInformation(
                                "✅ GEOCODING SUCCESS | Pedido={OrderId} | Lat={Lat:F6} | Lon={Lon:F6} | Provider={Provider}",
                                order.PublicId, coords.Value.lat, coords.Value.lon, providerName);
                        }
                        else
                        {
                            order.GeocodedAtUtc = DateTime.UtcNow;
                            order.GeocodeProvider = $"{providerName} (not_found)";

                            _logger.LogWarning(
                                "❌ GEOCODING NOT_FOUND | Pedido={OrderId} | Provider={Provider} | Query=\"{Query}\" | API retornou null",
                                order.PublicId, providerName, queryAddress);
                        }
                    }
                    catch (Exception ex)
                    {
                        order.GeocodedAtUtc = DateTime.UtcNow;
                        order.GeocodeProvider = $"{providerName} (error)";

                        _logger.LogError(ex,
                            "🔥 GEOCODING ERROR | Pedido={OrderId} | Provider={Provider} | Query=\"{Query}\" | Exception: {Message}",
                            order.PublicId, providerName, queryAddress, ex.Message);
                    }
                }
            }
            else
            {
                _logger.LogInformation(
                    "⏭️ GEOCODING SKIPPED | Pedido={OrderId} | Motivo: Já possui coordenadas | Lat={Lat:F6} | Lon={Lon:F6}",
                    order.PublicId, order.Latitude, order.Longitude);
            }
        }

        order.Status = newStatus;

        var updatedAt = DateTime.UtcNow;
        order.UpdatedAtUtc = updatedAt;

        await _db.SaveChangesAsync(ct);

        return Ok(new UpdateOrderStatusResponse(
            order.Id,
            order.PublicId,
            oldStatus.ToString(),
            order.Status.ToString(),
            updatedAt
        ));
    }

    private static bool IsValidTransition(OrderStatus from, OrderStatus to)
    {
        if (from == OrderStatus.CANCELADO) return false;
        if (to == OrderStatus.CANCELADO) return true;

        return (from, to) switch
        {
            (OrderStatus.RECEBIDO, OrderStatus.EM_PREPARO) => true,
            (OrderStatus.EM_PREPARO, OrderStatus.PRONTO_PARA_ENTREGA) => true,
            (OrderStatus.PRONTO_PARA_ENTREGA, OrderStatus.SAIU_PARA_ENTREGA) => true,
            (OrderStatus.SAIU_PARA_ENTREGA, OrderStatus.ENTREGUE) => true,
            _ => false
        };
    }
    [Authorize(Roles = "admin")]
    [HttpPost("geocode-missing")]
    public async Task<IActionResult> GeocodeMissing(
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        if (limit < 1) limit = 1;
        if (limit > 500) limit = 500;

        var providerName = (_config["Geocoding:Provider"] ?? "NOMINATIM").ToUpperInvariant();

        _logger.LogInformation(
            "Iniciando reprocessamento de geocoding. Limit={Limit}, Provider={Provider}",
            limit, providerName);

        var orders = await _db.Orders
            .Where(o => o.Status == OrderStatus.PRONTO_PARA_ENTREGA &&
                        (o.Latitude == null || o.Longitude == null))
            .OrderBy(o => o.CreatedAtUtc)
            .Take(limit)
            .ToListAsync(ct);

        _logger.LogInformation(
            "Encontrados {Count} pedidos sem coordenadas",
            orders.Count);

        var updated = 0;
        var notFound = 0;
        var errors = 0;

        foreach (var o in orders)
        {
            // ✅ Validação do endereço ANTES de geocodificar
            var hasAddress = !string.IsNullOrWhiteSpace(o.Address);
            var hasCep = !string.IsNullOrWhiteSpace(o.Cep);
            var cepIsValid = hasCep && o.Cep?.Replace("-", "").Length == 8;

            if (!hasAddress || !hasCep || !cepIsValid)
            {
                _logger.LogWarning(
                    "⚠️ BATCH GEOCODING SKIPPED | Pedido={OrderId} | Address={Address} | Cep={Cep} | Motivo: Dados incompletos/inválidos",
                    o.PublicId, o.Address ?? "(null)", o.Cep ?? "(null)");

                o.GeocodedAtUtc = DateTime.UtcNow;
                o.GeocodeProvider = $"{providerName} (incomplete_address)";
                notFound++;
                continue;
            }

            var queryAddress = await BuildGeocodingQueryAsync(o, ct);

            _logger.LogInformation(
                "🌍 BATCH GEOCODING CALL | Pedido={OrderId} | Query=\"{Query}\"",
                o.PublicId, queryAddress);

            try
            {
                var coords = await _geo.GeocodeAsync(queryAddress, ct);
                o.GeocodedAtUtc = DateTime.UtcNow;

                if (coords is not null)
                {
                    o.Latitude = coords.Value.lat;
                    o.Longitude = coords.Value.lon;
                    o.GeocodeProvider = providerName;
                    updated++;

                    _logger.LogInformation(
                        "✅ BATCH GEOCODING SUCCESS | Pedido={OrderId} | Lat={Lat:F6} | Lon={Lon:F6}",
                        o.PublicId, coords.Value.lat, coords.Value.lon);
                }
                else
                {
                    o.GeocodeProvider = $"{providerName} (not_found)";
                    notFound++;

                    _logger.LogWarning(
                        "❌ BATCH GEOCODING NOT_FOUND | Pedido={OrderId} | Query=\"{Query}\"",
                        o.PublicId, queryAddress);
                }
            }
            catch (Exception ex)
            {
                o.GeocodedAtUtc = DateTime.UtcNow;
                o.GeocodeProvider = $"{providerName} (error)";
                errors++;

                _logger.LogError(ex,
                    "🔥 BATCH GEOCODING ERROR | Pedido={OrderId} | Query=\"{Query}\" | Exception: {Message}",
                    o.PublicId, queryAddress, ex.Message);
            }

            // Pequeno delay para não sobrecarregar a API
            await Task.Delay(200, ct); // Aumentei de 100ms para 200ms para mais segurança
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Reprocessamento concluído. Total={Total}, Sucesso={Updated}, NãoEncontrado={NotFound}, Erros={Errors}",
            orders.Count, updated, notFound, errors);

        return Ok(new
        {
            total = orders.Count,
            updated,
            notFound,
            errors,
            provider = providerName
        });
    }

    // =========================
    // POST /orders/{id}/reprocess-geocoding
    // Reprocessa geocoding de um pedido específico (força reprocessamento mesmo se já tiver coords)
    // =========================
    [Authorize(Roles = "admin")]
    [HttpPost("{idOrNumber}/reprocess-geocoding")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(string), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReprocessGeocoding(
        [FromRoute] string idOrNumber,
        [FromQuery] bool force = false, // Se true, reprocessa mesmo que já tenha coords
        CancellationToken ct = default)
    {
        Order? order;

        if (Guid.TryParse(idOrNumber, out var id))
            order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
        else
            order = await _db.Orders.FirstOrDefaultAsync(o => o.PublicId == idOrNumber, ct);

        if (order is null)
            return NotFound("Pedido não encontrado.");

        var providerName = (_config["Geocoding:Provider"] ?? "NOMINATIM").ToUpperInvariant();

        // Verifica se já tem coords e não é force
        if (!force && order.Latitude is not null && order.Longitude is not null)
        {
            _logger.LogInformation(
                "⏭️ REPROCESS SKIPPED | Pedido={OrderId} | Motivo: Já possui coordenadas (use ?force=true para forçar) | Lat={Lat:F6} | Lon={Lon:F6}",
                order.PublicId, order.Latitude, order.Longitude);

            return Ok(new
            {
                order.PublicId,
                skipped = true,
                reason = "Pedido já possui coordenadas. Use ?force=true para forçar reprocessamento.",
                currentLat = order.Latitude,
                currentLon = order.Longitude,
                geocodedAt = order.GeocodedAtUtc,
                geocodeProvider = order.GeocodeProvider
            });
        }

        // ✅ Validação do endereço
        var hasAddress = !string.IsNullOrWhiteSpace(order.Address);
        var hasCep = !string.IsNullOrWhiteSpace(order.Cep);
        var cepIsValid = hasCep && order.Cep?.Replace("-", "").Length == 8;

        _logger.LogInformation(
            "📍 REPROCESS GEOCODING START | Pedido={OrderId} | Provider={Provider} | Force={Force} | HasAddress={HasAddress} | HasCep={HasCep} | CepValid={CepValid}",
            order.PublicId, providerName, force, hasAddress, hasCep, cepIsValid);

        if (!hasAddress || !hasCep)
        {
            _logger.LogWarning(
                "⚠️ REPROCESS FAILED | Pedido={OrderId} | Motivo: Endereço ou CEP ausente | Address=\"{Address}\" | Cep=\"{Cep}\"",
                order.PublicId, order.Address ?? "(null)", order.Cep ?? "(null)");

            return BadRequest(new
            {
                order.PublicId,
                success = false,
                error = "Endereço ou CEP ausente/inválido",
                address = order.Address,
                cep = order.Cep
            });
        }

        if (!cepIsValid)
        {
            _logger.LogWarning(
                "⚠️ REPROCESS FAILED | Pedido={OrderId} | Motivo: CEP inválido | Cep=\"{Cep}\"",
                order.PublicId, order.Cep);

            return BadRequest(new
            {
                order.PublicId,
                success = false,
                error = "CEP inválido (esperado 8 dígitos)",
                cep = order.Cep
            });
        }

        var queryAddress = await BuildGeocodingQueryAsync(order, ct);

        _logger.LogInformation(
            "🌍 REPROCESS GEOCODING CALL | Pedido={OrderId} | Provider={Provider} | Query=\"{Query}\"",
            order.PublicId, providerName, queryAddress);

        try
        {
            var coords = await _geo.GeocodeAsync(queryAddress, ct);

            if (coords is not null)
            {
                var oldLat = order.Latitude;
                var oldLon = order.Longitude;

                order.Latitude = coords.Value.lat;
                order.Longitude = coords.Value.lon;
                order.GeocodedAtUtc = DateTime.UtcNow;
                order.GeocodeProvider = providerName;

                await _db.SaveChangesAsync(ct);

                _logger.LogInformation(
                    "✅ REPROCESS SUCCESS | Pedido={OrderId} | OldLat={OldLat:F6} OldLon={OldLon:F6} | NewLat={NewLat:F6} NewLon={NewLon:F6}",
                    order.PublicId, oldLat, oldLon, coords.Value.lat, coords.Value.lon);

                return Ok(new
                {
                    order.PublicId,
                    success = true,
                    oldCoords = oldLat is not null && oldLon is not null ? new { lat = oldLat, lon = oldLon } : null,
                    newCoords = new { lat = coords.Value.lat, lon = coords.Value.lon },
                    geocodedAt = order.GeocodedAtUtc,
                    provider = providerName
                });
            }
            else
            {
                order.GeocodedAtUtc = DateTime.UtcNow;
                order.GeocodeProvider = $"{providerName} (not_found)";
                await _db.SaveChangesAsync(ct);

                _logger.LogWarning(
                    "❌ REPROCESS NOT_FOUND | Pedido={OrderId} | Query=\"{Query}\"",
                    order.PublicId, queryAddress);

                return Ok(new
                {
                    order.PublicId,
                    success = false,
                    error = "Coordenadas não encontradas pelo provedor de geocoding",
                    query = queryAddress,
                    provider = providerName
                });
            }
        }
        catch (Exception ex)
        {
            order.GeocodedAtUtc = DateTime.UtcNow;
            order.GeocodeProvider = $"{providerName} (error)";
            await _db.SaveChangesAsync(ct);

            _logger.LogError(ex,
                "🔥 REPROCESS ERROR | Pedido={OrderId} | Query=\"{Query}\" | Exception: {Message}",
                order.PublicId, queryAddress, ex.Message);

            return StatusCode(500, new
            {
                order.PublicId,
                success = false,
                error = "Erro ao chamar provedor de geocoding",
                message = ex.Message,
                provider = providerName
            });
        }
    }

    // =========================
    // POST /orders (public)
    // =========================
    [HttpPost]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(CreateOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(string), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CreateOrderResponse>> Create([FromBody] CreateOrderRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest("Carrinho vazio.");
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Nome do cliente é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Phone))
            return BadRequest("Telefone do cliente é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Cep))
            return BadRequest("CEP do endereço é obrigatório.");
        if (string.IsNullOrWhiteSpace(req.Address))
            return BadRequest("Endereço do cliente incompletos.");
        if (string.IsNullOrWhiteSpace(req.PaymentMethodStr))
            return BadRequest("Método de pagamento é obrigatório.");

        var order = new Order
        {
            Id = Guid.NewGuid(),
            PublicId = OrderIdGenerator.NewPublicId(),
            CustomerName = req.Name.Trim(),
            Phone = req.Phone.Trim(),
            Cep = req.Cep.Trim(),
            Address = req.Address.Trim(),
            Complement = string.IsNullOrWhiteSpace(req.Complement) ? null : req.Complement.Trim(),
            Coupon = string.IsNullOrWhiteSpace(req.Coupon) ? null : req.Coupon.Trim(),
            Status = OrderStatus.RECEBIDO,
            CreatedAtUtc = DateTime.UtcNow,
        };

        foreach (var item in req.Items)
        {
            if (item.Qty <= 0) return BadRequest("Quantidade inválida.");

            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId);
            if (product is null) return BadRequest($"Produto não encontrado: {item.ProductId}");

            order.Items.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                ProductNameSnapshot = product.Name,
                UnitPriceCentsSnapshot = product.PriceCents,
                Qty = item.Qty
            });
        }

        order.SubtotalCents = order.Items.Sum(it => it.UnitPriceCentsSnapshot * it.Qty);

        // MVP
        order.DeliveryCents = 500;
        order.TotalCents = order.SubtotalCents + order.DeliveryCents;

        var pm = (req.PaymentMethodStr ?? "PIX").Trim().ToUpperInvariant();
        order.PaymentMethod = pm;

        if (pm == "CASH")
        {
            if (req.CashGivenCents is null)
                return BadRequest("CashGivenCents é obrigatório quando PaymentMethodStr = CASH.");

            if (req.CashGivenCents.Value < order.TotalCents)
                return BadRequest("Valor em dinheiro insuficiente para o total do pedido.");

            order.CashGivenCents = req.CashGivenCents.Value;
            order.ChangeCents = req.CashGivenCents.Value - order.TotalCents;
        }
        else
        {
            order.CashGivenCents = null;
            order.ChangeCents = null;
        }

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return Ok(new CreateOrderResponse
        {
            Id = order.Id,
            OrderNumber = order.PublicId,
            Status = order.Status.ToString(),
            SubtotalCents = order.SubtotalCents,
            DeliveryCents = order.DeliveryCents,
            TotalCents = order.TotalCents,
            PaymentMethodStr = order.PaymentMethod,
            CashGivenCents = order.CashGivenCents,
            ChangeCents = order.ChangeCents
        });
    }
}
