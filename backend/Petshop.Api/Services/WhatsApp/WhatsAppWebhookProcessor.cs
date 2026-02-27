using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Contracts.WhatsApp;
using Petshop.Api.Data;
using Petshop.Api.Entities.WhatsApp;

namespace Petshop.Api.Services.WhatsApp;

/// <summary>
/// Job Hangfire que processa o payload do webhook da Meta em background.
/// O controller ack 200 imediatamente; este serviço faz o trabalho pesado.
/// </summary>
public class WhatsAppWebhookProcessor
{
    private readonly AppDbContext _db;
    private readonly WhatsAppInboundRouter _router;
    private readonly ILogger<WhatsAppWebhookProcessor> _logger;

    public WhatsAppWebhookProcessor(
        AppDbContext db,
        WhatsAppInboundRouter router,
        ILogger<WhatsAppWebhookProcessor> logger)
    {
        _db = db;
        _router = router;
        _logger = logger;
    }

    /// <summary>
    /// Ponto de entrada do job Hangfire.
    /// Recebe o payload raw (JSON string) para evitar problemas de serialização no Hangfire storage.
    /// </summary>
    public async Task ProcessAsync(string payloadJson, CancellationToken ct = default)
    {
        WhatsAppWebhookPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<WhatsAppWebhookPayload>(payloadJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WH_PARSE_ERROR | Não foi possível desserializar o payload do webhook");
            return;
        }

        if (payload is null || payload.Object != "whatsapp_business_account")
        {
            _logger.LogWarning("WH_SKIP | object={Object}", payload?.Object);
            return;
        }

        foreach (var entry in payload.Entry)
        {
            var wabaId = entry.Id;

            // Resolve empresa pelo WABA ID (multi-tenant)
            var companyId = await ResolveCompanyIdAsync(wabaId, ct);

            foreach (var change in entry.Changes)
            {
                if (change.Field != "messages") continue;

                var value = change.Value;

                // Mapa de wa_id → nome do contato para upsert posterior
                var contactNames = value.Contacts?
                    .ToDictionary(c => c.WaId, c => c.Profile?.Name ?? "")
                    ?? new Dictionary<string, string>();

                // ── Mensagens recebidas do cliente ────────────────────────────
                if (value.Messages is { Count: > 0 })
                {
                    foreach (var msg in value.Messages)
                    {
                        await ProcessInboundMessageAsync(msg, contactNames, wabaId, companyId, ct);
                    }
                }

                // ── Status de entrega (sent/delivered/read/failed) ────────────
                if (value.Statuses is { Count: > 0 })
                {
                    foreach (var status in value.Statuses)
                    {
                        await ProcessStatusUpdateAsync(status, wabaId, companyId, ct);
                    }
                }
            }
        }
    }

    // ── Mensagem recebida ─────────────────────────────────────────────────────

    private async Task ProcessInboundMessageAsync(
        WhatsAppInboundMessage msg,
        Dictionary<string, string> contactNames,
        string wabaId,
        Guid? companyId,
        CancellationToken ct)
    {
        // 1. Idempotência — já processado?
        if (await IsAlreadyProcessedAsync(msg.Id, "message", ct))
        {
            _logger.LogDebug(
                "WH_DEDUPE | EventId={EventId} | Tipo=message | Ignorado (já processado)",
                msg.Id);
            return;
        }

        _logger.LogInformation(
            "WH_MSG_IN | WabaId={WabaId} | CompanyId={CompanyId} | WaId={WaId} | MsgId={MsgId} | Type={Type}",
            wabaId, companyId, msg.From, msg.Id, msg.Type);

        // 2. Log da mensagem recebida
        var log = new WhatsAppMessageLog
        {
            CompanyId   = companyId ?? Guid.Empty,
            Direction   = "in",
            Wamid       = msg.Id,
            WaId        = msg.From,
            PayloadJson = JsonSerializer.Serialize(msg)
        };
        _db.WhatsAppMessageLogs.Add(log);

        // 3. Upsert do contato + atualiza nome e timestamp de inbound
        if (companyId.HasValue)
        {
            await UpsertContactAsync(
                companyId.Value,
                msg.From,
                contactNames.GetValueOrDefault(msg.From),
                inbound: true,
                ct);
        }

        // 4. Marca como processado (dedupe)
        await MarkAsProcessedAsync(msg.Id, "message", companyId, ct);
        await _db.SaveChangesAsync(ct);

        // 5. Roteamento de intenções (somente mensagens de texto, empresa conhecida)
        if (msg.Type == "text" && companyId.HasValue && !string.IsNullOrWhiteSpace(msg.Text?.Body))
        {
            try
            {
                await _router.RouteAsync(msg.From, msg.Text.Body, companyId.Value, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "WH_ROUTER_ERROR | WaId={WaId} | MsgId={MsgId} | Erro no roteamento",
                    msg.From, msg.Id);
            }
        }
    }

    // ── Status de entrega ─────────────────────────────────────────────────────

    private async Task ProcessStatusUpdateAsync(
        WhatsAppStatusUpdate status,
        string wabaId,
        Guid? companyId,
        CancellationToken ct)
    {
        // 1. Idempotência — o ID inclui o próprio status para diferenciar sent→delivered→read
        var dedupeKey = $"{status.Id}:{status.Status}";
        if (await IsAlreadyProcessedAsync(dedupeKey, "status", ct))
        {
            _logger.LogDebug(
                "WH_DEDUPE | EventId={EventId} | Tipo=status | Ignorado (já processado)",
                dedupeKey);
            return;
        }

        _logger.LogInformation(
            "WH_STATUS | WabaId={WabaId} | CompanyId={CompanyId} | WaId={WaId} | Wamid={Wamid} | Status={Status}",
            wabaId, companyId, status.RecipientId, status.Id, status.Status);

        // 2. Registra o status no log se já existe entrada para o wamid
        var existingLog = await _db.WhatsAppMessageLogs
            .FirstOrDefaultAsync(l => l.Wamid == status.Id, ct);

        if (existingLog is not null)
        {
            // Atualiza o payload com o status mais recente (append)
            existingLog.PayloadJson = JsonSerializer.Serialize(new
            {
                original = existingLog.PayloadJson,
                latestStatus = status
            });
        }

        // 3. Marca como processado
        await MarkAsProcessedAsync(dedupeKey, "status", companyId, ct);
        await _db.SaveChangesAsync(ct);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Resolve companyId a partir do WABA ID (entry.id do webhook).</summary>
    private async Task<Guid?> ResolveCompanyIdAsync(string wabaId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(wabaId)) return null;

        var integration = await _db.CompanyIntegrationsWhatsapp
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.WabaId == wabaId, ct);

        if (integration is null)
        {
            // Fallback: se só há uma empresa com cloud_api ativa, usa ela
            var activeIntegrations = await _db.CompanyIntegrationsWhatsapp
                .AsNoTracking()
                .Where(w => w.Mode == "cloud_api" && w.IsActive)
                .ToListAsync(ct);

            if (activeIntegrations.Count == 1)
                return activeIntegrations[0].CompanyId;

            _logger.LogWarning(
                "WH_COMPANY_NOT_FOUND | WabaId={WabaId} | Não foi possível resolver empresa",
                wabaId);
            return null;
        }

        return integration.CompanyId;
    }

    private async Task<bool> IsAlreadyProcessedAsync(string eventId, string eventType, CancellationToken ct)
        => await _db.WhatsAppWebhookDedupes
            .AnyAsync(d => d.EventId == eventId, ct);

    private async Task MarkAsProcessedAsync(string eventId, string eventType, Guid? companyId, CancellationToken ct)
    {
        // Usa INSERT com ignore de conflito via try/catch para evitar race condition
        try
        {
            _db.WhatsAppWebhookDedupes.Add(new WhatsAppWebhookDedupe
            {
                EventId   = eventId,
                EventType = eventType,
                CompanyId = companyId
            });
            // SaveChanges chamado pelo caller após todos os adds
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WH_DEDUPE_INSERT_WARN | EventId={EventId}", eventId);
        }
    }

    private async Task UpsertContactAsync(
        Guid companyId,
        string waId,
        string? profileName,
        bool inbound,
        CancellationToken ct)
    {
        var contact = await _db.WhatsAppContacts
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.WaId == waId, ct);

        if (contact is null)
        {
            contact = new WhatsAppContact
            {
                CompanyId   = companyId,
                WaId        = waId,
                ProfileName = profileName
            };
            _db.WhatsAppContacts.Add(contact);
        }
        else if (!string.IsNullOrWhiteSpace(profileName))
        {
            contact.ProfileName = profileName;
        }

        if (inbound)
            contact.LastInboundAtUtc = DateTime.UtcNow;
        else
            contact.LastOutboundAtUtc = DateTime.UtcNow;
    }
}
