using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.WhatsApp;
using Petshop.Api.Services.Customers;
using Petshop.Api.Services.Pdv;

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
        var loyaltyCta = await TryBuildLoyaltyDeliveredCtaAsync(order, triggerStatus, ct);

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

            if (loyaltyCta is not null)
            {
                await _wa.SendTextAsync(
                    waId,
                    $"Voce tem {loyaltyCta.PointsBalance} pontos. Consultar seus pontos: {loyaltyCta.Url}",
                    companyId,
                    ct);
            }
        }
        else
        {
            // Fallback texto livre — funciona somente dentro da janela de 24h
            // (após o cliente ter enviado mensagem). Não funciona para notificações cold.
            var message = BuildMessage(order, triggerStatus, loyaltyCta);
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

    private static string BuildMessage(Order order, OrderStatus status, LoyaltyDeliveredCta? loyaltyCta)
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
                if (loyaltyCta is not null)
                {
                    sb.AppendLine($"Você tem *{loyaltyCta.PointsBalance} pontos* no fidelidade.");
                    sb.AppendLine($"Consultar seus pontos: {loyaltyCta.Url}");
                }
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

    private async Task<LoyaltyDeliveredCta?> TryBuildLoyaltyDeliveredCtaAsync(
        Order order,
        OrderStatus status,
        CancellationToken ct)
    {
        if (status != OrderStatus.ENTREGUE) return null;
        if (!order.CompanyId.HasValue || !order.CustomerId.HasValue) return null;
        if (string.IsNullOrWhiteSpace(order.CustomerName) || string.IsNullOrWhiteSpace(order.Phone)) return null;

        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == order.CompanyId.Value && c.Id == order.CustomerId.Value)
            .FirstOrDefaultAsync(ct);
        if (customer is null || string.IsNullOrWhiteSpace(customer.CpfHash)) return null;

        var cpf = _cpfProtection.Unprotect(customer.Cpf);
        if (!CpfValidator.IsValid(cpf)) return null;

        var slug = await _db.Companies
            .AsNoTracking()
            .Where(c => c.Id == order.CompanyId.Value)
            .Select(c => c.Slug)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(slug)) return null;

        var baseDomain = (_config["TENANT_BASE_DOMAIN"] ?? "vendapps.com.br").Trim().Trim('.');
        var url = $"https://{slug}.{baseDomain}/loyalty";

        return new LoyaltyDeliveredCta(customer.PointsBalance, url);
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
            _logger.LogInformation("WA_SALE_OK | SaleId={SaleId} | PublicId={Id} | Wamid={Wamid}", saleId, sale.PublicId, wamid);
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

    private sealed record LoyaltyDeliveredCta(int PointsBalance, string Url);
}
