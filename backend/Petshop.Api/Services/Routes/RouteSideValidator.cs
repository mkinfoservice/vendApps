using Petshop.Api.Entities;

namespace Petshop.Api.Services.Routes;

public class RouteSideValidator
{
    private readonly NeighborhoodClassificationService _classification;
    private readonly ILogger<RouteSideValidator> _logger;

    public RouteSideValidator(
        NeighborhoodClassificationService classification,
        ILogger<RouteSideValidator> logger)
    {
        _classification = classification;
        _logger = logger;
    }

    /// <summary>
    /// Filtra pedidos por RouteSide (A ou B).
    ///
    /// Se RouteSide for null/vazio, retorna todos os pedidos (comportamento original).
    /// Se RouteSide for "A" ou "B", retorna apenas pedidos classificados nesse lado.
    /// </summary>
    /// <returns>Tupla: (pedidos filtrados, lista de warnings)</returns>
    public (List<Order> filtered, List<string> warnings) FilterByRouteSide(
        List<Order> orders,
        string? routeSide)
    {
        // Se RouteSide não especificado, retorna todos os pedidos
        if (string.IsNullOrWhiteSpace(routeSide))
            return (orders, new List<string>());

        var sideUpper = routeSide.Trim().ToUpperInvariant();
        if (sideUpper != "A" && sideUpper != "B")
            throw new ArgumentException("RouteSide deve ser 'A' ou 'B'");

        var filtered = new List<Order>();
        var warnings = new List<string>();

        foreach (var order in orders)
        {
            var classification = _classification.ClassifyOrder(order);

            if (classification == sideUpper)
            {
                filtered.Add(order);
                _logger.LogDebug("✅ Pedido {OrderId} ({PublicId}) pertence à Rota {Side}",
                    order.Id, order.PublicId, sideUpper);
            }
            else
            {
                var warning = $"⚠️ Pedido {order.PublicId} classificado como Rota {classification}, ignorado para Rota {sideUpper}";
                warnings.Add(warning);
                _logger.LogWarning("⚠️ Pedido {OrderId} ({PublicId}) classificado como Rota {Class}, ignorado para RouteSide={Side}",
                    order.Id, order.PublicId, classification, sideUpper);
            }
        }

        if (filtered.Count == 0)
        {
            _logger.LogWarning("🚫 Nenhum pedido classificado como Rota {Side} após filtro", sideUpper);
        }
        else
        {
            _logger.LogInformation("✅ {Count} pedidos filtrados para Rota {Side}", filtered.Count, sideUpper);
        }

        return (filtered, warnings);
    }

    /// <summary>
    /// Valida se todos os pedidos pertencem ao RouteSide especificado
    /// </summary>
    public bool ValidateAllOrders(List<Order> orders, string routeSide)
    {
        if (string.IsNullOrWhiteSpace(routeSide))
            return true;

        var sideUpper = routeSide.Trim().ToUpperInvariant();
        if (sideUpper != "A" && sideUpper != "B")
            return false;

        return orders.All(o => _classification.ClassifyOrder(o) == sideUpper);
    }
}
