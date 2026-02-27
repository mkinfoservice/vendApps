using System.Text;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.WhatsApp;

namespace Petshop.Api.Services.WhatsApp;

/// <summary>
/// Roteador de mensagens inbound do WhatsApp para pós-venda.
/// Identifica a intenção do cliente e responde automaticamente.
///
/// Intents MVP:
///   rastrear  → status do pedido mais recente + ETA
///   troca     → instruções de troca/devolução
///   histórico → últimos pedidos do cliente
///   atendente → handoff para humano
///   (default) → menu de ajuda
/// </summary>
public class WhatsAppInboundRouter
{
    private readonly AppDbContext _db;
    private readonly WhatsAppClient _wa;
    private readonly ILogger<WhatsAppInboundRouter> _logger;

    public WhatsAppInboundRouter(
        AppDbContext db,
        WhatsAppClient wa,
        ILogger<WhatsAppInboundRouter> logger)
    {
        _db = db;
        _wa = wa;
        _logger = logger;
    }

    /// <summary>
    /// Ponto de entrada: recebe mensagem de texto e decide o que responder.
    /// </summary>
    public async Task RouteAsync(
        string waId,
        string text,
        Guid companyId,
        CancellationToken ct = default)
    {
        _logger.LogInformation(
            "WA_INBOUND | CompanyId={CompanyId} | WaId={WaId} | Text={Text}",
            companyId, waId, text.Length > 80 ? text[..80] + "…" : text);

        // 1. Carrega (ou cria) contato e seu estado de conversa
        var contact = await GetOrCreateContactAsync(waId, companyId, ct);

        // 2. Se está em handoff humano, não responde automaticamente
        if (contact.ConversationState == WhatsAppConversationState.HumanHandoff)
        {
            _logger.LogInformation(
                "WA_INBOUND_SKIP | WaId={WaId} | Estado=human_handoff — aguardando atendimento humano",
                waId);
            return;
        }

        // 3. Detecta intent
        var intent = DetectIntent(text);

        _logger.LogInformation(
            "WA_INTENT | WaId={WaId} | Intent={Intent}",
            waId, intent);

        // 4. Executa intent
        string? reply = intent switch
        {
            Intent.Tracking  => await HandleTrackingAsync(waId, companyId, ct),
            Intent.Return    => HandleReturn(),
            Intent.History   => await HandleHistoryAsync(waId, companyId, ct),
            Intent.HumanHandoff => await HandleHumanHandoffAsync(contact, ct),
            _                => HandleHelp(),
        };

        if (reply is null) return;

        // 5. Atualiza estado da conversa
        contact.ConversationState = intent switch
        {
            Intent.Tracking     => WhatsAppConversationState.Tracking,
            Intent.Return       => WhatsAppConversationState.Return,
            Intent.History      => WhatsAppConversationState.History,
            Intent.HumanHandoff => WhatsAppConversationState.HumanHandoff,
            _                   => WhatsAppConversationState.Idle,
        };
        contact.LastOutboundAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        // 6. Envia resposta
        await _wa.SendTextAsync(waId, reply, companyId, ct);
    }

    // ── Handlers por intent ───────────────────────────────────────────────────

    private async Task<string?> HandleTrackingAsync(string waId, Guid companyId, CancellationToken ct)
    {
        var orders = await FindOrdersByPhoneAsync(waId, companyId, ct);

        if (orders.Count == 0)
            return "Não encontrei nenhum pedido recente associado ao seu número. " +
                   "Confirme o telefone cadastrado ou entre em contato com a loja. 🔍";

        var latest = orders[0];
        var sb = new StringBuilder();
        sb.AppendLine($"📦 *Pedido {latest.PublicId}*");
        sb.AppendLine($"Status: *{FormatStatus(latest.Status)}*");
        sb.AppendLine($"Total: R$ {latest.TotalCents / 100m:N2}".Replace('.', ','));
        sb.AppendLine($"Realizado em: {latest.CreatedAtUtc.ToLocalTime():dd/MM/yyyy HH:mm}");

        if (latest.Status == OrderStatus.ENTREGUE)
            sb.AppendLine("\n✅ Pedido já entregue. Obrigado pela preferência!");
        else if (latest.Status == OrderStatus.CANCELADO)
            sb.AppendLine("\n❌ Pedido cancelado. Precisa de ajuda? Responda *atendente*.");
        else
            sb.AppendLine("\nQualquer dúvida, responda *atendente* para falar com a equipe.");

        return sb.ToString().TrimEnd();
    }

    private static string HandleReturn() =>
        "Entendemos! 😊 Para solicitar uma troca ou devolução:\n\n" +
        "1️⃣ Guarde o produto na embalagem original\n" +
        "2️⃣ Responda *atendente* para falar com nossa equipe\n" +
        "3️⃣ Informe o número do pedido e o motivo\n\n" +
        "Prazo de troca: até *7 dias* após o recebimento (Código de Defesa do Consumidor).";

    private async Task<string?> HandleHistoryAsync(string waId, Guid companyId, CancellationToken ct)
    {
        var orders = await FindOrdersByPhoneAsync(waId, companyId, ct);

        if (orders.Count == 0)
            return "Não encontrei pedidos associados ao seu número. 🔍\n" +
                   "Confirme se o telefone cadastrado é o mesmo deste WhatsApp.";

        var sb = new StringBuilder();
        sb.AppendLine($"📋 *Seus últimos {orders.Count} pedido(s):*\n");

        foreach (var o in orders)
        {
            sb.AppendLine($"• *{o.PublicId}* — {FormatStatus(o.Status)}");
            sb.AppendLine($"  R$ {o.TotalCents / 100m:N2} | {o.CreatedAtUtc.ToLocalTime():dd/MM/yy}".Replace('.', ','));
        }

        sb.AppendLine("\nPara detalhes de um pedido específico, responda *rastrear*.");
        return sb.ToString().TrimEnd();
    }

    private async Task<string?> HandleHumanHandoffAsync(WhatsAppContact contact, CancellationToken ct)
    {
        contact.ConversationState = WhatsAppConversationState.HumanHandoff;
        await _db.SaveChangesAsync(ct);

        return "👤 Você foi direcionado para atendimento humano!\n\n" +
               "Nossa equipe entrará em contato em breve. " +
               "Em horário comercial o retorno é em até *30 minutos*. ⏱️\n\n" +
               "Enquanto isso, você pode nos informar já aqui:\n" +
               "• Número do pedido\n" +
               "• Qual a sua dúvida ou problema";
    }

    private static string HandleHelp() =>
        "Olá! 👋 Posso te ajudar com:\n\n" +
        "📦 *rastrear* — Ver status do seu pedido\n" +
        "🔄 *troca* — Solicitar troca ou devolução\n" +
        "📋 *histórico* — Ver seus pedidos anteriores\n" +
        "👤 *atendente* — Falar com nossa equipe\n\n" +
        "É só responder com uma das opções acima!";

    // ── Detecção de intent ────────────────────────────────────────────────────

    private static Intent DetectIntent(string text)
    {
        var t = text.Trim().ToLowerInvariant()
            .Replace("á","a").Replace("ã","a").Replace("â","a").Replace("à","a")
            .Replace("é","e").Replace("ê","e")
            .Replace("í","i")
            .Replace("ó","o").Replace("ô","o").Replace("õ","o")
            .Replace("ú","u").Replace("ü","u")
            .Replace("ç","c");

        if (ContainsAny(t, "rastrear","rastreio","onde esta","onde está","status","acompanhar",
                           "meu pedido","cadê","cade","chegou","entregou","entregue"))
            return Intent.Tracking;

        if (ContainsAny(t, "troca","trocar","devolucao","devolver","devolveu","defeito",
                           "danificado","errado","reclamar","reembolso","cancelar"))
            return Intent.Return;

        if (ContainsAny(t, "historico","meus pedidos","pedidos anteriores","compras"))
            return Intent.History;

        if (ContainsAny(t, "atendente","humano","pessoa","suporte","ajuda","help",
                           "falar com","quero falar","preciso falar","equipe"))
            return Intent.HumanHandoff;

        return Intent.Unknown;
    }

    private static bool ContainsAny(string text, params string[] keywords)
        => keywords.Any(k => text.Contains(k, StringComparison.Ordinal));

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Busca pedidos recentes da empresa cujo telefone normalizado bate com o wa_id.</summary>
    private async Task<List<Order>> FindOrdersByPhoneAsync(string waId, Guid companyId, CancellationToken ct)
    {
        // Carrega últimos 10 pedidos da empresa (últimos 90 dias) e filtra em memória
        // para compatibilidade com telefones não-E164 cadastrados
        var cutoff = DateTime.UtcNow.AddDays(-90);

        var candidates = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.CompanyId == companyId && o.CreatedAtUtc >= cutoff)
            .OrderByDescending(o => o.CreatedAtUtc)
            .Take(20)
            .ToListAsync(ct);

        return candidates
            .Where(o => WhatsAppClient.NormalizeToE164Brazil(o.Phone) == waId)
            .Take(5)
            .ToList();
    }

    private async Task<WhatsAppContact> GetOrCreateContactAsync(
        string waId, Guid companyId, CancellationToken ct)
    {
        var contact = await _db.WhatsAppContacts
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.WaId == waId, ct);

        if (contact is null)
        {
            contact = new WhatsAppContact
            {
                CompanyId = companyId,
                WaId      = waId,
            };
            _db.WhatsAppContacts.Add(contact);
            await _db.SaveChangesAsync(ct);
        }

        return contact;
    }

    private static string FormatStatus(OrderStatus s) => s switch
    {
        OrderStatus.RECEBIDO             => "Recebido ✅",
        OrderStatus.EM_PREPARO           => "Em preparo 👨‍🍳",
        OrderStatus.PRONTO_PARA_ENTREGA  => "Pronto para entrega 📦",
        OrderStatus.SAIU_PARA_ENTREGA    => "Saiu para entrega 🛵",
        OrderStatus.ENTREGUE             => "Entregue ✅",
        OrderStatus.CANCELADO            => "Cancelado ❌",
        _                                => s.ToString()
    };

    private enum Intent { Tracking, Return, History, HumanHandoff, Unknown }
}
