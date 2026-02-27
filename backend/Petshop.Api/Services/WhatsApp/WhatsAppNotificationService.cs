using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.WhatsApp;

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
    private readonly ILogger<WhatsAppNotificationService> _logger;

    public WhatsAppNotificationService(
        AppDbContext db,
        WhatsAppClient wa,
        ILogger<WhatsAppNotificationService> logger)
    {
        _db = db;
        _wa = wa;
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

        // 2. Carrega config WhatsApp da empresa
        var integration = await _db.CompanyIntegrationsWhatsapp
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsActive, ct);

        if (integration is null || integration.Mode != "cloud_api")
        {
            _logger.LogDebug(
                "WA_NOTIFY_SKIP | OrderId={OrderId} | CompanyId={CompanyId} | Integração cloud_api não ativa",
                orderId, companyId);
            return;
        }

        // 3. Verifica se este status está na lista de notificações configuradas
        if (!ShouldNotify(integration.NotifyOnStatuses, triggerStatus))
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
        var templateName = ResolveTemplateName(integration.NotificationTemplatesJson, triggerStatus);

        string? wamid;
        string sendMode;

        if (templateName is not null)
        {
            // Usa template aprovado (obrigatório para mensagens business-initiated)
            // Variáveis padrão: {{1}}=nome, {{2}}=número do pedido, {{3}}=mensagem de status
            var bodyParams = new List<string>
            {
                order.CustomerName.Split(' ')[0],         // {{1}} primeiro nome
                order.PublicId,                           // {{2}} número do pedido
                GetStatusLabel(triggerStatus)             // {{3}} label do status
            };

            wamid = await _wa.SendTemplateAsync(
                waId, templateName, integration.TemplateLanguageCode, bodyParams, companyId, ct);
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
        }
        else
        {
            _logger.LogWarning(
                "WA_NOTIFY_FAIL | OrderId={OrderId} | OrderNumber={OrderNumber} | Status={Status} | WaId={WaId} | Envio falhou (wamid null)",
                orderId, order.PublicId, triggerKey, waId);
        }
    }

    // ── Resolução de template ─────────────────────────────────────────────────

    /// <summary>
    /// Retorna o nome do template configurado para o status, ou null se não houver.
    /// notificationTemplatesJson format: {"RECEBIDO":"pedido_recebido","ENTREGUE":"pedido_entregue"}
    /// </summary>
    private static string? ResolveTemplateName(string? notificationTemplatesJson, OrderStatus status)
    {
        if (string.IsNullOrWhiteSpace(notificationTemplatesJson)) return null;
        try
        {
            var map = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(
                notificationTemplatesJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (map is null) return null;
            map.TryGetValue(status.ToString(), out var templateName);
            return string.IsNullOrWhiteSpace(templateName) ? null : templateName.Trim();
        }
        catch { return null; }
    }

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
}
