using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Marketplace;
using Petshop.Api.Services.Marketplace.IFood;

namespace Petshop.Api.Controllers;

/// <summary>
/// CRUD de integrações com marketplaces + ações manuais (sync catálogo).
/// Rota base: /admin/marketplace
/// </summary>
[ApiController]
[Route("admin/marketplace")]
[Authorize(Roles = "admin,gerente")]
public class AdminMarketplaceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly iFoodCatalogSyncService _catalogSync;
    private readonly ILogger<AdminMarketplaceController> _logger;

    public AdminMarketplaceController(
        AppDbContext db,
        iFoodCatalogSyncService catalogSync,
        ILogger<AdminMarketplaceController> logger)
    {
        _db = db;
        _catalogSync = catalogSync;
        _logger = logger;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/marketplace ────────────────────────────────────────────────

    [HttpGet]
    public async Task<ActionResult<List<MarketplaceIntegrationDto>>> List(CancellationToken ct)
    {
        var list = await _db.MarketplaceIntegrations
            .AsNoTracking()
            .Where(i => i.CompanyId == CompanyId)
            .OrderBy(i => i.DisplayName)
            .ToListAsync(ct);

        return list.Select(ToDto).ToList();
    }

    // ── GET /admin/marketplace/{id} ───────────────────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MarketplaceIntegrationDto>> Get(Guid id, CancellationToken ct)
    {
        var integration = await _db.MarketplaceIntegrations
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == CompanyId, ct);

        if (integration is null) return NotFound();
        return ToDto(integration);
    }

    // ── POST /admin/marketplace ───────────────────────────────────────────────

    [HttpPost]
    public async Task<ActionResult<MarketplaceIntegrationDto>> Create(
        [FromBody] UpsertMarketplaceIntegrationRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.MerchantId))
            return BadRequest(new { error = "MerchantId é obrigatório." });
        if (string.IsNullOrWhiteSpace(req.ClientId))
            return BadRequest(new { error = "ClientId é obrigatório." });
        if (string.IsNullOrWhiteSpace(req.ClientSecret))
            return BadRequest(new { error = "ClientSecret é obrigatório." });

        var integration = new MarketplaceIntegration
        {
            CompanyId              = CompanyId,
            Type                   = req.Type,
            MerchantId             = req.MerchantId.Trim(),
            DisplayName            = req.DisplayName?.Trim() ?? req.MerchantId.Trim(),
            ClientId               = req.ClientId.Trim(),
            ClientSecretEncrypted  = req.ClientSecret.Trim(), // em produção: criptografar via IDataProtector
            WebhookSecret          = req.WebhookSecret?.Trim(),
            AutoAcceptOrders       = req.AutoAcceptOrders,
            AutoPrint              = req.AutoPrint,
            IsActive               = true,
        };

        _db.MarketplaceIntegrations.Add(integration);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("[Marketplace] Integração criada. Id={Id} Tipo={T} Merchant={M}",
            integration.Id, integration.Type, integration.MerchantId);

        return CreatedAtAction(nameof(Get), new { id = integration.Id }, ToDto(integration));
    }

    // ── PUT /admin/marketplace/{id} ───────────────────────────────────────────

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MarketplaceIntegrationDto>> Update(
        Guid id,
        [FromBody] UpsertMarketplaceIntegrationRequest req,
        CancellationToken ct)
    {
        var integration = await _db.MarketplaceIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == CompanyId, ct);

        if (integration is null) return NotFound();

        integration.DisplayName      = req.DisplayName?.Trim() ?? integration.DisplayName;
        integration.MerchantId       = req.MerchantId.Trim();
        integration.ClientId         = req.ClientId.Trim();
        integration.AutoAcceptOrders = req.AutoAcceptOrders;
        integration.AutoPrint        = req.AutoPrint;
        integration.WebhookSecret    = req.WebhookSecret?.Trim();

        // Só atualiza o secret se foi enviado (não vazio)
        if (!string.IsNullOrWhiteSpace(req.ClientSecret))
            integration.ClientSecretEncrypted = req.ClientSecret.Trim();

        await _db.SaveChangesAsync(ct);
        return ToDto(integration);
    }

    // ── DELETE /admin/marketplace/{id} (soft-delete = desativa) ──────────────

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        var integration = await _db.MarketplaceIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == CompanyId, ct);

        if (integration is null) return NotFound();

        integration.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /admin/marketplace/{id}/sync-catalog ─────────────────────────────

    [HttpPost("{id:guid}/sync-catalog")]
    public async Task<ActionResult<CatalogSyncResult>> SyncCatalog(Guid id, CancellationToken ct)
    {
        var integration = await _db.MarketplaceIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == CompanyId && i.IsActive, ct);

        if (integration is null) return NotFound();

        if (integration.Type != MarketplaceType.IFood)
            return BadRequest(new { error = "Sync de catálogo só está disponível para integrações iFood." });

        var result = await _catalogSync.SyncPricesAsync(integration, ct);

        if (result.ErrorMessage is not null)
            return StatusCode(502, result);

        return Ok(result);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static MarketplaceIntegrationDto ToDto(MarketplaceIntegration i) => new(
        i.Id,
        i.Type.ToString(),
        i.MerchantId,
        i.DisplayName,
        i.ClientId,
        i.WebhookSecret,
        i.AutoAcceptOrders,
        i.AutoPrint,
        i.IsActive,
        i.CreatedAtUtc,
        i.LastOrderReceivedAtUtc,
        i.LastCatalogSyncAtUtc,
        i.LastErrorMessage,
        WebhookUrl: $"/webhooks/marketplace/{i.Id}"
    );
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record MarketplaceIntegrationDto(
    Guid Id,
    string Type,
    string MerchantId,
    string DisplayName,
    string ClientId,
    string? WebhookSecret,
    bool AutoAcceptOrders,
    bool AutoPrint,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? LastOrderReceivedAtUtc,
    DateTime? LastCatalogSyncAtUtc,
    string? LastErrorMessage,
    string WebhookUrl // URL que deve ser configurada no portal do marketplace
);

public record UpsertMarketplaceIntegrationRequest(
    MarketplaceType Type,
    string MerchantId,
    string ClientId,
    string ClientSecret,       // nunca retornado no GET — write-only
    string? DisplayName,
    string? WebhookSecret,
    bool AutoAcceptOrders = true,
    bool AutoPrint = true
);
