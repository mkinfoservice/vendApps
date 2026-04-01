using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Marketplace;
using Petshop.Api.Services.Marketplace;
using Petshop.Api.Services.Marketplace.IFood;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoint público (sem JWT) para receber webhooks dos marketplaces.
/// Responde 202 imediatamente e processa em background.
///
/// URL: POST /webhooks/marketplace/{integrationId}
///
/// Para configurar no portal iFood: https://vendapps.onrender.com/webhooks/marketplace/{integrationId}
/// </summary>
[ApiController]
[Route("webhooks/marketplace")]
public class MarketplaceWebhookController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEnumerable<IMarketplaceOrderIngester> _ingesters;
    private readonly ILogger<MarketplaceWebhookController> _logger;

    public MarketplaceWebhookController(
        AppDbContext db,
        IEnumerable<IMarketplaceOrderIngester> ingesters,
        ILogger<MarketplaceWebhookController> logger)
    {
        _db        = db;
        _ingesters = ingesters;
        _logger    = logger;
    }

    /// <summary>
    /// Recebe evento de webhook do marketplace.
    /// O {integrationId} é o ID interno da MarketplaceIntegration — inclua na URL configurada no portal.
    /// </summary>
    [HttpPost("{integrationId:guid}")]
    public async Task<IActionResult> Receive(
        Guid integrationId,
        CancellationToken ct)
    {
        // Lê corpo antes de qualquer await longo (ASP.NET Core pode descartar o stream)
        string rawPayload;
        using (var reader = new System.IO.StreamReader(Request.Body))
            rawPayload = await reader.ReadToEndAsync(ct);

        var signature = Request.Headers["X-IFood-Signature"].FirstOrDefault()
                     ?? Request.Headers["X-Marketplace-Signature"].FirstOrDefault();

        // Responde imediatamente — o iFood exige 202 em < 5s
        // O processamento pesado ocorre no background (fire-and-forget com logging)
        _ = Task.Run(async () =>
        {
            try
            {
                await ProcessAsync(integrationId, rawPayload, signature, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webhook] Falha no processamento background. IntegrationId={Id}", integrationId);
            }
        }, CancellationToken.None);

        return Accepted();
    }

    private async Task ProcessAsync(
        Guid integrationId,
        string rawPayload,
        string? signature,
        CancellationToken ct)
    {
        var integration = await _db.MarketplaceIntegrations
            .FirstOrDefaultAsync(i => i.Id == integrationId && i.IsActive, ct);

        if (integration is null)
        {
            _logger.LogWarning("[Webhook] IntegrationId não encontrado ou inativo: {Id}", integrationId);
            return;
        }

        var ingester = _ingesters.FirstOrDefault(i => i.Type == integration.Type);
        if (ingester is null)
        {
            _logger.LogError("[Webhook] Nenhum ingester registrado para tipo {T}.", integration.Type);
            return;
        }

        var result = await ingester.IngestAsync(rawPayload, signature, integration, ct);

        if (!result.Success && result.ErrorMessage is not null)
        {
            integration.LastErrorMessage = result.ErrorMessage;
            await _db.SaveChangesAsync(ct);
        }
    }
}
