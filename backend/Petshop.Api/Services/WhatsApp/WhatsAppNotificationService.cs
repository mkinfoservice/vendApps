using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Master;
using Petshop.Api.Entities.WhatsApp;
using Petshop.Api.Services.Customers;
using Petshop.Api.Services.Pdv;
using Petshop.Api.Services.Tenancy;

namespace Petshop.Api.Services.WhatsApp;

/// <summary>
/// Envia notificações WhatsApp ao cliente em cada mudança de status do pedido.
/// Ativado como job Hangfire: fire-and-forget, sem bloquear o fluxo do pedido.
/// Idempotência: verifica WhatsAppMessageLog por (OrderId + TriggerStatus) antes de enviar.
/// </summary>
public class WhatsAppNotificationService
{
    private readonly AppDbContext _db;
    private readonly WhatsAppClient _wa;
    private readonly SaleReceiptPdfService _pdf;
    private readonly CpfProtectionService _cpfProtection;
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppNotificationService> _logger;

    public WhatsAppNotificationService(
        AppDbContext db,
        WhatsAppClient wa,
        SaleReceiptPdfService pdf,
        CpfProtectionService cpfProtection,
        IConfiguration config,
        ILogger<WhatsAppNotificationService> logger)
    {
        _db = db;
        _wa = wa;
        _pdf = pdf;
        _cpfProtection = cpfProtection;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Ponto de entrada do job Hangfire.
    /// Recebe apenas IDs para evitar problemas de serialização no storage.
    /// </summary>
    public async Task NotifyOrderStatusAsync(
        Guid orderId,
        OrderStatus triggerStatus,
        CancellationToken ct = default)
    {
        // 1. Carrega pedido com itens
        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order is null)
        {
            _logger.LogWarning(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | Pedido não encontrado",
                orderId);
            return;
        }

        if (!order.CompanyId.HasValue)
        {
            _logger.LogWarning(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | OrderNumber={OrderNumber} | CompanyId ausente",
                orderId, order.PublicId);
            return;
        }

        var companyId = order.CompanyId.Value;

        // 2. Carrega modo WhatsApp da empresa e integração
        var companyWaMode = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.WhatsappMode)
            .FirstOrDefaultAsync(ct) ?? "none";

        if (companyWaMode == "none")
        {
            _logger.LogDebug(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | CompanyId={CompanyId} | WhatsappMode=none",
                orderId, companyId);
            return;
        }

        var integration = await _db.CompanyIntegrationsWhatsapp
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsActive, ct);

        var canSend = companyWaMode == "platform" || (integration?.Mode == "cloud_api");
        if (!canSend)
        {
            _logger.LogDebug(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | CompanyId={CompanyId} | WhatsappMode={Mode} sem cloud_api ativo",
                orderId, companyId, companyWaMode);
            return;
        }

        // 3. Verifica se este status está na lista de notificações configuradas
        if (!ShouldNotify(integration?.NotifyOnStatuses, triggerStatus))
        {
            _logger.LogDebug(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | Status={Status} | Não está em NotifyOnStatuses",
                orderId, triggerStatus);
            return;
        }

        // 4. Idempotência — já enviamos para este (orderId + status)?
        var triggerKey = triggerStatus.ToString();
        var alreadySent = await _db.WhatsAppMessageLogs
            .AnyAsync(l =>
                l.OrderId == orderId &&
                l.TriggerStatus == triggerKey &&
                l.Direction == "out", ct);

        if (alreadySent)
        {
            _logger.LogDebug(
                "WA_NOTIFY_DEDUPE | OrderId={OrderId} | Status={Status} | Já enviado anteriormente",
                orderId, triggerKey);
            return;
        }

        // 5. Normaliza telefone para E.164
        var waId = WhatsAppClient.NormalizeToE164Brazil(order.Phone);
        if (waId is null)
        {
            _logger.LogWarning(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | OrderNumber={OrderNumber} | Telefone inválido: {Phone}",
                orderId, order.PublicId, order.Phone);
            return;
        }

        // 6. Resolve template ou fallback para texto livre
        var templateName = ResolveTemplateName(integration?.NotificationTemplatesJson, triggerStatus);
        var langCode     = integration?.TemplateLanguageCode ?? "pt_BR";

        string? wamid;
        string sendMode;
        if (templateName is not null)
        {
            // Usa template aprovado (obrigatório para mensagens business-initiated)
            // Variáveis padrão: {{1}}=nome, {{2}}=número do pedido
            var bodyParams = new List<string>
            {
                order.CustomerName.Split(' ')[0],         // {{1}} primeiro nome
                order.PublicId,                           // {{2}} número do pedido
            };

            wamid = await _wa.SendTemplateAsync(
                waId, templateName, langCode, bodyParams, companyId, ct);
            sendMode = $"template:{templateName}";
        }
        else
        {
            // Fallback texto livre — funciona somente dentro da janela de 24h
            // (após o cliente ter enviado mensagem). Não funciona para notificações cold.
            var message = BuildMessage(order, triggerStatus);
            wamid = await _wa.SendTextAsync(waId, message, companyId, ct);
            sendMode = "text";
        }

        // 7. Loga (independente do sucesso — nil wamid significa falha já logada pelo client)
        var log = new WhatsAppMessageLog
        {
            CompanyId     = companyId,
            Direction     = "out",
            Wamid         = wamid,
            WaId          = waId,
            OrderId       = orderId,
            TriggerStatus = triggerKey,
            PayloadJson   = JsonSerializer.Serialize(new
            {
                orderNumber = order.PublicId,
                status      = triggerKey,
                phone       = order.Phone,
                waId,
                sendMode
            })
        };
        _db.WhatsAppMessageLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        if (wamid is not null)
        {
            _logger.LogInformation(
                "WA_NOTIFY_OK | OrderId={OrderId} | OrderNumber={OrderNumber} | Status={Status} | WaId={WaId} | Wamid={Wamid}",
                orderId, order.PublicId, triggerKey, waId, wamid);

            await TrySendLoyaltyDeliveredComplementAsync(
                order,
                triggerStatus,
                waId,
                companyId,
                integration,
                wamid,
                ct);
        }
        else
        {
            _logger.LogWarning(
                "WA_NOTIFY_FAIL | OrderId={OrderId} | OrderNumber={OrderNumber} | Status={Status} | WaId={WaId} | Envio falhou (wamid null)",
                orderId, order.PublicId, triggerKey, waId);
        }
    }

    // ── Resolução de template por OrderStatus ────────────────────────────────

    private static string? ResolveTemplateName(string? json, OrderStatus status)
        => ResolveTemplateName(json, status.ToString());

    private static string GetStatusLabel(OrderStatus s) => s switch
    {
        OrderStatus.RECEBIDO            => "Pedido recebido",
        OrderStatus.EM_PREPARO          => "Em preparo",
        OrderStatus.PRONTO_PARA_ENTREGA => "Pronto para entrega",
        OrderStatus.SAIU_PARA_ENTREGA   => "Saiu para entrega",
        OrderStatus.ENTREGUE            => "Entregue",
        OrderStatus.CANCELADO           => "Cancelado",
        _                               => s.ToString()
    };

    // ── Verificação de status configurado ────────────────────────────────────

    private static bool ShouldNotify(string? notifyOnStatusesJson, OrderStatus status)
    {
        // Se não há configuração, notifica tudo
        if (string.IsNullOrWhiteSpace(notifyOnStatusesJson))
            return true;

        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(notifyOnStatusesJson);
            if (list is null || list.Count == 0) return true;

            return list.Any(s =>
                string.Equals(s.Trim(), status.ToString(), StringComparison.OrdinalIgnoreCase));
        }
        catch
        {
            return true; // Em caso de JSON inválido, notifica por segurança
        }
    }

    /// <summary>
    /// Retorna true se SALE_COMPLETED estiver explicitamente na lista de notifyOnStatuses.
    /// Diferente de ShouldNotify: aqui a ausência de configuração significa NÃO enviar
    /// (opt-in), enquanto os status de pedido têm comportamento opt-out (enviam por padrão).
    /// </summary>
    private static bool ShouldNotifySaleCompleted(string? notifyOnStatusesJson)
    {
        if (string.IsNullOrWhiteSpace(notifyOnStatusesJson))
            return false;

        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(notifyOnStatusesJson);
            if (list is null || list.Count == 0) return false;

            return list.Any(s =>
                string.Equals(s.Trim(), "SALE_COMPLETED", StringComparison.OrdinalIgnoreCase));
        }
        catch
        {
            return false;
        }
    }

    // ── Builder de mensagens por status ──────────────────────────────────────

    private static string BuildMessage(Order order, OrderStatus status)
    {
        var sb = new StringBuilder();
        var name = order.CustomerName.Split(' ')[0]; // Primeiro nome

        switch (status)
        {
            case OrderStatus.RECEBIDO:
                sb.AppendLine($"Olá, *{name}*! 🎉");
                sb.AppendLine();
                sb.AppendLine($"Seu pedido *{order.PublicId}* foi recebido com sucesso!");
                sb.AppendLine();
                sb.AppendLine("📋 *Resumo do pedido:*");
                foreach (var item in order.Items)
                {
                    sb.AppendLine($"  • {item.Qty}x {item.ProductNameSnapshot} — {FormatBrl(item.UnitPriceCentsSnapshot * item.Qty)}");
                }
                sb.AppendLine();
                sb.AppendLine($"💰 *Subtotal:* {FormatBrl(order.SubtotalCents)}");
                sb.AppendLine($"🚚 *Entrega:* {FormatBrl(order.DeliveryCents)}");
                sb.AppendLine($"💳 *Total:* {FormatBrl(order.TotalCents)}");
                sb.AppendLine($"💵 *Pagamento:* {FormatPayment(order)}");
                sb.AppendLine();
                sb.AppendLine("Fique de olho — você receberá atualizações aqui. 😊");
                break;

            case OrderStatus.EM_PREPARO:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* está sendo preparado! 👨‍🍳");
                sb.AppendLine("Em breve ficará pronto.");
                break;

            case OrderStatus.PRONTO_PARA_ENTREGA:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* está pronto! 📦");
                sb.AppendLine("Nosso entregador irá buscá-lo em instantes.");
                break;

            case OrderStatus.SAIU_PARA_ENTREGA:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* saiu para entrega! 🛵");
                sb.AppendLine("Ele está a caminho. Aguarde!");
                break;

            case OrderStatus.ENTREGUE:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* foi entregue! ✅");
                sb.AppendLine("Obrigado pela preferência. Até a próxima! 🙏");
                break;

            case OrderStatus.CANCELADO:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* foi cancelado. ❌");
                sb.AppendLine("Se tiver alguma dúvida, responda esta mensagem.");
                break;

            default:
                sb.AppendLine($"*{name}*, seu pedido *{order.PublicId}* teve uma atualização.");
                sb.AppendLine($"Status atual: *{status}*");
                break;
        }

        return sb.ToString().TrimEnd();
    }

    private async Task TrySendLoyaltyDeliveredComplementAsync(
        Order order,
        OrderStatus status,
        string waId,
        Guid companyId,
        CompanyIntegrationWhatsapp? integration,
        string mainWamid,
        CancellationToken ct)
    {
        try
        {
            var eligibility = await ResolveLoyaltyComplementEligibilityAsync(order, status, companyId, waId, integration, ct);
            if (eligibility is null)
                return;

            var delaySeconds = GetLoyaltyComplementDelaySeconds();
            if (delaySeconds > 0)
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);

            // Usa template aprovado se configurado em NotificationTemplatesJson["LOYALTY_COMPLEMENT"]
            // ou fallback para config WhatsApp:LoyaltyComplement:TemplateName
            var loyaltyTemplateName = ResolveTemplateName(integration?.NotificationTemplatesJson, "LOYALTY_COMPLEMENT")
                ?? _config["WhatsApp:LoyaltyComplement:TemplateName"];
            var langCode = integration?.TemplateLanguageCode ?? "pt_BR";

            string? complementWamid;
            if (!string.IsNullOrWhiteSpace(loyaltyTemplateName))
            {
                var bodyParams = new List<string>
                {
                    eligibility.FirstName,
                    eligibility.EarnedPoints.ToString(),
                    eligibility.PointsBalance.ToString()
                };
                complementWamid = await _wa.SendTemplateAsync(
                    waId, loyaltyTemplateName, langCode, bodyParams, companyId, ct);
            }
            else
            {
                // Fallback texto livre — funciona somente dentro da janela de 24h
                var text = BuildLoyaltyComplementMessage(eligibility.PointsBalance, eligibility.Url);
                complementWamid = await _wa.SendTextAsync(waId, text, companyId, ct);
            }
            if (complementWamid is null)
            {
                _logger.LogWarning(
                    "WA_NOTIFY_LOYALTY_COMPLEMENT_FAIL | OrderId={OrderId} | OrderNumber={OrderNumber} | MainWamid={MainWamid} | WaId={WaId} | wamid null",
                    order.Id, order.PublicId, mainWamid, waId);
                return;
            }

            _db.WhatsAppMessageLogs.Add(new WhatsAppMessageLog
            {
                CompanyId = companyId,
                Direction = "out",
                Wamid = complementWamid,
                WaId = waId,
                OrderId = order.Id,
                TriggerStatus = GetLoyaltyComplementTrigger(status),
                PayloadJson = JsonSerializer.Serialize(new
                {
                    orderNumber = order.PublicId,
                    status = status.ToString(),
                    complement = "loyalty_balance",
                    pointsBalance = eligibility.PointsBalance,
                    loyaltyUrl = eligibility.Url,
                    waId,
                    mainWamid
                })
            });
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "WA_NOTIFY_LOYALTY_COMPLEMENT_OK | OrderId={OrderId} | OrderNumber={OrderNumber} | MainWamid={MainWamid} | ComplementWamid={ComplementWamid} | Points={Points}",
                order.Id, order.PublicId, mainWamid, complementWamid, eligibility.PointsBalance);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "WA_NOTIFY_LOYALTY_COMPLEMENT_WARN | OrderId={OrderId} | OrderNumber={OrderNumber} | Falha complementar (principal mantida)",
                order.Id, order.PublicId);
        }
    }

    private async Task<LoyaltyComplementEligibility?> ResolveLoyaltyComplementEligibilityAsync(
        Order order,
        OrderStatus status,
        Guid companyId,
        string waId,
        CompanyIntegrationWhatsapp? integration,
        CancellationToken ct)
    {
        if (status != OrderStatus.ENTREGUE) return null;
        if (!order.CompanyId.HasValue || !order.CustomerId.HasValue) return null;
        if (string.IsNullOrWhiteSpace(order.Phone) || string.IsNullOrWhiteSpace(waId)) return null;
        if (!IsLoyaltyComplementEnabled()) return null;
        if (!ShouldNotify(integration?.NotifyOnStatuses, status)) return null;

        var loyaltyFeatureEnabled = await IsLoyaltyFeatureEnabledAsync(companyId, ct);
        if (!loyaltyFeatureEnabled) return null;

        var triggerKey = GetLoyaltyComplementTrigger(status);
        var alreadySent = await _db.WhatsAppMessageLogs
            .AsNoTracking()
            .AnyAsync(l =>
                l.OrderId == order.Id &&
                l.TriggerStatus == triggerKey &&
                l.Direction == "out", ct);
        if (alreadySent)
        {
            _logger.LogDebug(
                "WA_NOTIFY_LOYALTY_COMPLEMENT_DEDUPE | OrderId={OrderId} | Status={Status} | Ja enviado",
                order.Id, triggerKey);
            return null;
        }

        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.Id == order.CustomerId.Value)
            .Select(c => new { c.Cpf, c.CpfHash, c.PointsBalance })
            .FirstOrDefaultAsync(ct);
        if (customer is null || string.IsNullOrWhiteSpace(customer.CpfHash)) return null;

        var cpf = _cpfProtection.Unprotect(customer.Cpf);
        if (!CpfValidator.IsValid(cpf)) return null;

        if (customer.PointsBalance < 0) return null;
        if (customer.PointsBalance == 0 && !ShouldSendWhenPointsIsZero()) return null;

        var loyaltyUrl = await BuildLoyaltyUrlAsync(companyId, ct);
        if (loyaltyUrl is null) return null;

        var firstName = (order.CustomerName ?? "").Split(' ')[0];

        // Busca pontos acumulados nesta transação:
        // - PDV: via SaleOrderId (Order espelho tem OriginSaleOrderId)
        // - Delivery: via OrderId (adicionado em 20260414)
        int earnedPoints = 0;
        if (order.OriginSaleOrderId.HasValue)
        {
            earnedPoints = await _db.LoyaltyTransactions
                .AsNoTracking()
                .Where(t => t.CompanyId == companyId
                         && t.CustomerId == order.CustomerId.Value
                         && t.SaleOrderId == order.OriginSaleOrderId.Value
                         && t.Points > 0)
                .OrderByDescending(t => t.CreatedAtUtc)
                .Select(t => t.Points)
                .FirstOrDefaultAsync(ct);
        }
        else
        {
            earnedPoints = await _db.LoyaltyTransactions
                .AsNoTracking()
                .Where(t => t.CompanyId == companyId
                         && t.CustomerId == order.CustomerId.Value
                         && t.OrderId == order.Id
                         && t.Points > 0)
                .OrderByDescending(t => t.CreatedAtUtc)
                .Select(t => t.Points)
                .FirstOrDefaultAsync(ct);
        }

        return new LoyaltyComplementEligibility(customer.PointsBalance, loyaltyUrl, firstName, earnedPoints);
    }

    private async Task<bool> IsLoyaltyFeatureEnabledAsync(Guid companyId, CancellationToken ct)
    {
        var companyPlan = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Plan)
            .FirstOrDefaultAsync(ct);

        var enabled = PlanFeatureService.IsPlanAtLeast(companyPlan, "trial");
        var featureOverride = await _db.CompanyFeatureOverrides
            .AsNoTracking()
            .Where(x => x.CompanyId == companyId && x.FeatureKey == AppFeatureKeys.LoyaltyProgram)
            .Select(x => (bool?)x.IsEnabled)
            .FirstOrDefaultAsync(ct);

        if (featureOverride.HasValue)
            enabled = featureOverride.Value;

        return enabled;
    }

    private async Task<string?> BuildLoyaltyUrlAsync(Guid companyId, CancellationToken ct)
    {
        var slug = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Slug)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(slug)) return null;

        var baseDomain = (_config["TENANT_BASE_DOMAIN"] ?? "vendapps.com.br").Trim().Trim('.');
        var rawUrl = $"https://{slug}.{baseDomain}/loyalty";
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri)) return null;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return null;

        return uri.ToString();
    }

    private bool IsLoyaltyComplementEnabled()
    {
        return _config.GetValue("WhatsApp:LoyaltyComplement:Enabled", true);
    }

    private bool ShouldSendWhenPointsIsZero()
    {
        return _config.GetValue("WhatsApp:LoyaltyComplement:SendWhenPointsZero", false);
    }

    private int GetLoyaltyComplementDelaySeconds()
    {
        var configured = _config.GetValue<int?>("WhatsApp:LoyaltyComplement:DelaySeconds");
        if (configured is null) return 2;
        return Math.Clamp(configured.Value, 0, 10);
    }

    private static string BuildLoyaltyComplementMessage(int pointsBalance, string loyaltyUrl)
    {
        return
            $"Seu saldo atual no programa de fidelidade é de {pointsBalance} ponto(s).\n" +
            $"Consulte seus pontos em: {loyaltyUrl}";
    }

    private static string GetLoyaltyComplementTrigger(OrderStatus status)
        => $"{status}_LOYALTY_COMPLEMENT";

    // ── Fidelidade PDV direta (independente de NFC-e) ────────────────────────

    /// <summary>
    /// Envia o complemento de fidelidade após venda PDV, independente de NFC-e ou WhatsApp SALE_COMPLETED.
    /// Disparado diretamente após EarnAsync, sem aguardar processamento fiscal.
    /// Idempotência: chave PDV_LOYALTY_COMPLEMENT + saleId no PayloadJson.
    /// Também verifica se o caminho SALE_COMPLETED já enviou via ENTREGUE_LOYALTY_COMPLEMENT para não duplicar.
    /// </summary>
    public async Task SendPdvLoyaltyComplementAsync(Guid saleId, CancellationToken ct = default)
    {
        try
        {
            var sale = await _db.SaleOrders
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == saleId, ct);
            if (sale is null) return;

            var companyId = sale.CompanyId;

            var companyWaMode = await _db.Companies
                .AsNoTracking()
                .Where(c => c.Id == companyId)
                .Select(c => c.WhatsappMode)
                .FirstOrDefaultAsync(ct) ?? "none";
            if (companyWaMode == "none") return;

            var integration = await _db.CompanyIntegrationsWhatsapp
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsActive, ct);

            var canSend = companyWaMode == "platform" || (integration?.Mode == "cloud_api");
            if (!canSend) return;

            if (!IsLoyaltyComplementEnabled()) return;
            if (!await IsLoyaltyFeatureEnabledAsync(companyId, ct)) return;

            // Tenta telefone da venda; fallback no cadastro do cliente
            var rawPhone = sale.CustomerPhone;
            if (string.IsNullOrWhiteSpace(rawPhone) && sale.CustomerId.HasValue)
            {
                rawPhone = await _db.Customers
                    .AsNoTracking()
                    .Where(c => c.Id == sale.CustomerId.Value && c.CompanyId == companyId)
                    .Select(c => c.Phone)
                    .FirstOrDefaultAsync(ct);
            }

            var waId = WhatsAppClient.NormalizeToE164Brazil(rawPhone);
            if (waId is null) return;

            const string triggerKey = "PDV_LOYALTY_COMPLEMENT";
            var saleIdStr = saleId.ToString();

            // Idempotência própria
            var alreadySent = await _db.WhatsAppMessageLogs
                .AnyAsync(l => l.TriggerStatus == triggerKey
                             && l.Direction == "out"
                             && l.PayloadJson != null && l.PayloadJson.Contains(saleIdStr), ct);
            if (alreadySent)
            {
                _logger.LogDebug("WA_PDV_LOYALTY_DEDUPE | SaleId={SaleId} | Já enviado via PDV_LOYALTY_COMPLEMENT", saleId);
                return;
            }

            // Também verifica se SALE_COMPLETED já enviou o complemento via pedido espelho
            var mirrorOrderId = await _db.Orders
                .AsNoTracking()
                .Where(o => o.OriginSaleOrderId == saleId && o.CompanyId == companyId)
                .Select(o => (Guid?)o.Id)
                .FirstOrDefaultAsync(ct);

            if (mirrorOrderId.HasValue)
            {
                var alreadySentViaMirror = await _db.WhatsAppMessageLogs
                    .AnyAsync(l => l.OrderId == mirrorOrderId.Value
                                 && l.TriggerStatus == "ENTREGUE_LOYALTY_COMPLEMENT"
                                 && l.Direction == "out", ct);
                if (alreadySentViaMirror)
                {
                    _logger.LogDebug("WA_PDV_LOYALTY_DEDUPE | SaleId={SaleId} | Já enviado via ENTREGUE_LOYALTY_COMPLEMENT", saleId);
                    return;
                }
            }

            if (!sale.CustomerId.HasValue) return;

            var customer = await _db.Customers
                .AsNoTracking()
                .Where(c => c.CompanyId == companyId && c.Id == sale.CustomerId.Value)
                .Select(c => new { c.PointsBalance })
                .FirstOrDefaultAsync(ct);
            if (customer is null) return;
            if (customer.PointsBalance < 0) return;
            if (customer.PointsBalance == 0 && !ShouldSendWhenPointsIsZero()) return;

            var earnedPoints = await _db.LoyaltyTransactions
                .AsNoTracking()
                .Where(t => t.CompanyId == companyId
                         && t.CustomerId == sale.CustomerId.Value
                         && t.SaleOrderId == saleId
                         && t.Points > 0)
                .OrderByDescending(t => t.CreatedAtUtc)
                .Select(t => t.Points)
                .FirstOrDefaultAsync(ct);

            var loyaltyUrl = await BuildLoyaltyUrlAsync(companyId, ct);
            if (loyaltyUrl is null) return;

            var firstName = (sale.CustomerName ?? "").Split(' ')[0];

            var delaySeconds = GetLoyaltyComplementDelaySeconds();
            if (delaySeconds > 0)
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);

            var loyaltyTemplateName = ResolveTemplateName(integration?.NotificationTemplatesJson, "LOYALTY_COMPLEMENT")
                ?? _config["WhatsApp:LoyaltyComplement:TemplateName"];
            var langCode = integration?.TemplateLanguageCode ?? "pt_BR";

            string? wamid;
            if (!string.IsNullOrWhiteSpace(loyaltyTemplateName))
            {
                var bodyParams = new List<string>
                {
                    firstName,
                    earnedPoints.ToString(),
                    customer.PointsBalance.ToString(),
                };
                wamid = await _wa.SendTemplateAsync(waId, loyaltyTemplateName, langCode, bodyParams, companyId, ct);
            }
            else
            {
                var text = BuildLoyaltyComplementMessage(customer.PointsBalance, loyaltyUrl);
                wamid = await _wa.SendTextAsync(waId, text, companyId, ct);
            }

            if (wamid is null)
            {
                _logger.LogWarning("WA_PDV_LOYALTY_FAIL | SaleId={SaleId} | WaId={WaId} | wamid null", saleId, waId);
                return;
            }

            _db.WhatsAppMessageLogs.Add(new WhatsAppMessageLog
            {
                CompanyId     = companyId,
                Direction     = "out",
                Wamid         = wamid,
                WaId          = waId,
                OrderId       = mirrorOrderId,
                TriggerStatus = triggerKey,
                PayloadJson   = JsonSerializer.Serialize(new
                {
                    saleId        = saleIdStr,
                    complement    = "loyalty_balance",
                    earnedPoints,
                    pointsBalance = customer.PointsBalance,
                    loyaltyUrl,
                }),
            });
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "WA_PDV_LOYALTY_OK | SaleId={SaleId} | Wamid={Wamid} | EarnedPoints={Earned} | Balance={Balance}",
                saleId, wamid, earnedPoints, customer.PointsBalance);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WA_PDV_LOYALTY_WARN | SaleId={SaleId} | Falha ao enviar complemento de fidelidade PDV", saleId);
        }
    }

    // ── Notificação de venda PDV (NFC-e por WhatsApp) ─────────────────────────

    /// <summary>
    /// Envia comprovante NFC-e via WhatsApp após autorização fiscal.
    /// Usa a chave SALE_COMPLETED em NotificationTemplatesJson para o nome do template.
    /// Template: purchase_receipt_1 — vars: {{1}}=nome, {{2}}=valor (45,79), {{3}}=publicId.
    /// </summary>
    public async Task NotifySaleCompletedAsync(
        Guid saleId,
        CancellationToken ct = default)
    {
        var sale = await _db.SaleOrders
            .AsNoTracking()
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale is null)
        {
            _logger.LogWarning("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | Venda não encontrada", saleId);
            return;
        }

        var companyId = sale.CompanyId;

        // Carrega modo WhatsApp da empresa (own/platform/none)
        var companyWaMode = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.WhatsappMode)
            .FirstOrDefaultAsync(ct) ?? "none";

        if (companyWaMode == "none")
        {
            _logger.LogDebug("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | WhatsappMode=none", saleId);
            return;
        }

        // Carrega integração WhatsApp ativa (onde ficam os templates configurados)
        var integration = await _db.CompanyIntegrationsWhatsapp
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsActive, ct);

        // Permite envio se empresa usa cloud_api próprio OU modo platform (credenciais globais)
        var canSend = companyWaMode == "platform" || (integration?.Mode == "cloud_api");
        if (!canSend)
        {
            _logger.LogDebug("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | WhatsappMode={Mode} sem cloud_api ativo", saleId, companyWaMode);
            return;
        }

        // Verifica se SALE_COMPLETED está habilitado em NotifyOnStatuses
        if (!ShouldNotifySaleCompleted(integration?.NotifyOnStatuses))
        {
            _logger.LogDebug("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | SALE_COMPLETED não está em NotifyOnStatuses", saleId);
            return;
        }

        // Verifica se template SALE_COMPLETED está configurado
        var templateName = ResolveTemplateName(integration?.NotificationTemplatesJson, "SALE_COMPLETED");
        if (templateName is null)
        {
            _logger.LogDebug("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | SALE_COMPLETED não configurado", saleId);
            return;
        }

        // Normaliza telefone do cliente
        var waId = WhatsAppClient.NormalizeToE164Brazil(sale.CustomerPhone);
        if (waId is null)
        {
            _logger.LogDebug("WA_SALE_NOTIFY_SKIP | SaleId={SaleId} | Sem telefone ou inválido", saleId);
            return;
        }

        // Idempotência — já enviamos comprovante para esta venda?
        var alreadySent = await _db.WhatsAppMessageLogs
            .AnyAsync(l => l.TriggerStatus == "SALE_COMPLETED"
                        && l.Direction == "out"
                        && l.PayloadJson != null && l.PayloadJson.Contains(saleId.ToString()),
                ct);

        if (alreadySent)
        {
            _logger.LogDebug("WA_SALE_NOTIFY_DEDUPE | SaleId={SaleId} | Comprovante já enviado", saleId);
            return;
        }

        // Carrega nome da empresa para o PDF
        var company = await _db.Companies.AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Name })
            .FirstOrDefaultAsync(ct);

        // Gera PDF
        byte[] pdfBytes;
        try
        {
            pdfBytes = _pdf.Generate(sale, company?.Name ?? "VendApps");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WA_SALE_PDF_ERROR | SaleId={SaleId}", saleId);
            return;
        }

        // Faz upload do PDF para a API de mídia da Meta
        var filename = $"recibo-{sale.PublicId}.pdf";
        var mediaId = await _wa.UploadMediaAsync(pdfBytes, "application/pdf", filename, companyId, ct);
        if (mediaId is null)
        {
            _logger.LogWarning("WA_SALE_UPLOAD_FAIL | SaleId={SaleId} | Upload do PDF falhou", saleId);
            return;
        }

        // Body params: {{1}}=primeiro nome, {{2}}=valor formatado, {{3}}=publicId
        var firstName  = (sale.CustomerName ?? "").Split(' ')[0];
        var totalFmt   = (sale.TotalCents / 100m).ToString("N2").Replace('.', ',');
        var bodyParams = new List<string> { firstName, totalFmt, sale.PublicId };

        var langCode = integration?.TemplateLanguageCode ?? "pt_BR";
        var wamid = await _wa.SendTemplateWithDocumentAsync(
            waId, templateName, langCode, mediaId, filename, bodyParams, companyId, ct);

        // Log
        var log = new WhatsAppMessageLog
        {
            CompanyId     = companyId,
            Direction     = "out",
            Wamid         = wamid,
            WaId          = waId,
            TriggerStatus = "SALE_COMPLETED",
            PayloadJson   = JsonSerializer.Serialize(new
            {
                saleId   = saleId.ToString(),
                publicId = sale.PublicId,
                phone    = sale.CustomerPhone,
                waId,
                templateName,
                mediaId
            })
        };
        _db.WhatsAppMessageLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        if (wamid is not null)
        {
            _logger.LogInformation("WA_SALE_OK | SaleId={SaleId} | PublicId={Id} | Wamid={Wamid}", saleId, sale.PublicId, wamid);

            // Tenta enviar complementar de fidelidade usando o Order espelho criado no Pay,
            // que tem CustomerId e segue o mesmo fluxo de elegibilidade das entregas.
            var mirroredOrder = await _db.Orders
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.OriginSaleOrderId == saleId && o.CompanyId == companyId, ct);

            if (mirroredOrder is not null)
            {
                await TrySendLoyaltyDeliveredComplementAsync(
                    mirroredOrder,
                    OrderStatus.ENTREGUE,
                    waId,
                    companyId,
                    integration,
                    wamid,
                    ct);
            }
        }
        else
            _logger.LogWarning("WA_SALE_FAIL | SaleId={SaleId} | PublicId={Id} | wamid null", saleId, sale.PublicId);
    }

    // ── Resolução de template por chave genérica ──────────────────────────────

    private static string? ResolveTemplateName(string? json, string key)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, string>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (map is null) return null;
            map.TryGetValue(key, out var name);
            return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        }
        catch { return null; }
    }

    // ── Formatação ────────────────────────────────────────────────────────────

    private static string FormatBrl(int cents)
    {
        var value = cents / 100m;
        return $"R$ {value:N2}".Replace('.', ',');
    }

    private static string FormatPayment(Order order) => order.PaymentMethod switch
    {
        "PIX"  => "Pix",
        "CARD" => "Cartão",
        "CASH" when order.ChangeCents.HasValue
               => $"Dinheiro (troco: {FormatBrl(order.ChangeCents.Value)})",
        "CASH" => "Dinheiro",
        _      => order.PaymentMethod
    };

    private sealed record LoyaltyComplementEligibility(int PointsBalance, string Url, string FirstName, int EarnedPoints);
}
