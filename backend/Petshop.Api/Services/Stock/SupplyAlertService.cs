using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;
using Petshop.Api.Entities.Master;
using Petshop.Api.Services.WhatsApp;

namespace Petshop.Api.Services.Stock;

/// <summary>
/// Cria alertas e notificações WhatsApp quando um insumo fica abaixo do mínimo.
/// Extraído do SuppliesController para ser reutilizável no PDV e em outros fluxos.
/// </summary>
public class SupplyAlertService
{
    private readonly AppDbContext    _db;
    private readonly WhatsAppClient  _whatsApp;
    private readonly ILogger<SupplyAlertService> _logger;

    public SupplyAlertService(
        AppDbContext db,
        WhatsAppClient whatsApp,
        ILogger<SupplyAlertService> logger)
    {
        _db       = db;
        _whatsApp = whatsApp;
        _logger   = logger;
    }

    /// <summary>
    /// Se o insumo estiver abaixo do mínimo: cria AdminAlert (deduplicado) e
    /// envia mensagem WhatsApp para o proprietário (se configurado).
    /// Operação best-effort — não lança exceção.
    /// </summary>
    public async Task EnsureLowStockAlertAsync(Supply supply, Guid companyId, CancellationToken ct = default)
    {
        try
        {
            if (supply.MinQty <= 0 || supply.StockQty > supply.MinQty) return;

            // Deduplicação: não cria novo alerta se já existe um não lido para este insumo
            var exists = await _db.AdminAlerts.AnyAsync(a =>
                a.CompanyId  == companyId &&
                a.AlertType  == "supply_low" &&
                a.ReferenceId == supply.Id &&
                !a.IsRead, ct);

            if (exists) return;

            _db.AdminAlerts.Add(new AdminAlert
            {
                CompanyId   = companyId,
                AlertType   = "supply_low",
                Title       = $"Insumo baixo: {supply.Name}",
                Message     = $"O insumo \"{supply.Name}\" está com estoque baixo: " +
                              $"{supply.StockQty:G} {supply.Unit} " +
                              $"(mínimo: {supply.MinQty:G} {supply.Unit}). Recomendamos reabastecer.",
                ReferenceId = supply.Id,
            });
            await _db.SaveChangesAsync(ct);

            // WhatsApp — não obrigatório (pode não estar configurado)
            var company = await _db.Companies
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == companyId, ct);

            var ownerPhone = WhatsAppClient.NormalizeToE164Brazil(company?.OwnerAlertPhone);
            if (ownerPhone is null) return;

            var text = $"[Alerta de insumo] {supply.Name} está em {supply.StockQty:G} {supply.Unit} " +
                       $"(mínimo {supply.MinQty:G} {supply.Unit}). Reabastecimento recomendado.";

            await _whatsApp.SendTextAsync(ownerPhone, text, companyId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SupplyAlert] Falha ao criar alerta para insumo {SupplyId}.", supply.Id);
        }
    }

    /// <summary>
    /// Verifica e notifica uma lista de insumos (para uso pós-venda PDV).
    /// </summary>
    public async Task EnsureLowStockAlertsAsync(IEnumerable<Supply> supplies, Guid companyId, CancellationToken ct = default)
    {
        foreach (var supply in supplies)
            await EnsureLowStockAlertAsync(supply, companyId, ct);
    }
}
