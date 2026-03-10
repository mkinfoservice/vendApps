using Microsoft.AspNetCore.SignalR;

namespace Petshop.Api.Hubs;

/// <summary>
/// Hub SignalR para envio de eventos de impressão ao painel admin.
/// O cliente se conecta e entra no grupo "company-{companyId}".
/// O servidor emite "PrintOrder" com o payload do pedido.
/// </summary>
public class PrintHub : Hub
{
    /// <summary>
    /// Chamado pelo cliente admin ao conectar.
    /// O cliente informa seu companyId para entrar no grupo correto.
    /// </summary>
    public async Task JoinCompany(string companyId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"company-{companyId}");
    }

    public async Task LeaveCompany(string companyId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"company-{companyId}");
    }
}
