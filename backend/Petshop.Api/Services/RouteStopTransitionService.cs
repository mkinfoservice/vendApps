using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities;
using Petshop.Api.Entities.Delivery;
using Route = Petshop.Api.Entities.Delivery.Route;

namespace Petshop.Api.Services;

public class RouteStopTransitionService
{
    private readonly AppDbContext _db;
    private readonly ILogger<RouteStopTransitionService> _logger;

    public RouteStopTransitionService(AppDbContext db, ILogger<RouteStopTransitionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public static bool IsFinalStopStatus(RouteStopStatus st) =>
        st == RouteStopStatus.Entregue ||
        st == RouteStopStatus.Falhou ||
        st == RouteStopStatus.Ignorada;

    /// <summary>
    /// Inicia a rota: muda status para EmAndamento, primeira stop pendente vira Proxima.
    /// </summary>
    public StartRouteResult StartRoute(Route route)
    {
        if (route.Status == RouteStatus.Cancelada)
            return StartRouteResult.Fail("Rota está cancelada.");

        if (route.Status == RouteStatus.Concluida)
            return StartRouteResult.Fail("Rota já está concluída.");

        if (route.Status != RouteStatus.Criada && route.Status != RouteStatus.Atribuida)
            return StartRouteResult.Fail($"Rota não pode ser iniciada a partir de {route.Status}.");

        route.Status = RouteStatus.EmAndamento;
        route.StartedAtUtc = DateTime.UtcNow;

        var first = route.Stops
            .OrderBy(s => s.Sequence)
            .FirstOrDefault();

        if (first != null && first.Status == RouteStopStatus.Pendente)
            first.Status = RouteStopStatus.Proxima;

        _logger.LogInformation("🚀 Rota {RouteNumber} iniciada", route.RouteNumber);
        return StartRouteResult.Ok();
    }

    /// <summary>
    /// Marca stop como entregue, avança próxima, auto-completa rota se necessário.
    /// </summary>
    public async Task<StopTransitionResult> MarkDeliveredAsync(Route route, Guid stopId, CancellationToken ct = default)
    {
        if (route.Status != RouteStatus.EmAndamento)
            return StopTransitionResult.Fail("Rota precisa estar EmAndamento para concluir paradas.");

        var stop = route.Stops.FirstOrDefault(s => s.Id == stopId);
        if (stop is null)
            return StopTransitionResult.Fail("Parada não encontrada.");

        if (IsFinalStopStatus(stop.Status))
            return StopTransitionResult.Fail($"Parada já está finalizada ({stop.Status}).");

        stop.Status = RouteStopStatus.Entregue;
        stop.DeliveredAtUtc = DateTime.UtcNow;

        // Atualiza pedido para ENTREGUE
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == stop.OrderId, ct);
        if (order != null && order.Status == OrderStatus.SAIU_PARA_ENTREGA)
            order.Status = OrderStatus.ENTREGUE;

        AdvanceNextStop(route);
        var allDone = CheckRouteCompletion(route);

        _logger.LogInformation("✅ Stop {StopId} entregue na rota {RouteNumber}", stopId, route.RouteNumber);
        return StopTransitionResult.Ok(stop, allDone);
    }

    /// <summary>
    /// Marca stop como falha, reverte pedido para PRONTO_PARA_ENTREGA, avança próxima.
    /// </summary>
    public async Task<StopTransitionResult> MarkFailedAsync(Route route, Guid stopId, string reason, CancellationToken ct = default)
    {
        if (route.Status != RouteStatus.EmAndamento)
            return StopTransitionResult.Fail("Rota precisa estar EmAndamento para marcar falha.");

        var stop = route.Stops.FirstOrDefault(s => s.Id == stopId);
        if (stop is null)
            return StopTransitionResult.Fail("Parada não encontrada.");

        if (IsFinalStopStatus(stop.Status))
            return StopTransitionResult.Fail($"Parada já está finalizada ({stop.Status}).");

        stop.Status = RouteStopStatus.Falhou;
        stop.FailedAtUtc = DateTime.UtcNow;
        stop.FailureReason = reason.Trim();

        // Reverte pedido para PRONTO_PARA_ENTREGA (para replanejar)
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == stop.OrderId, ct);
        if (order != null && order.Status == OrderStatus.SAIU_PARA_ENTREGA)
            order.Status = OrderStatus.PRONTO_PARA_ENTREGA;

        AdvanceNextStop(route);
        var allDone = CheckRouteCompletion(route);

        _logger.LogInformation("❌ Stop {StopId} falhou na rota {RouteNumber}: {Reason}", stopId, route.RouteNumber, reason);
        return StopTransitionResult.Ok(stop, allDone);
    }

    /// <summary>
    /// Marca stop como ignorada (pulada), reverte pedido para PRONTO_PARA_ENTREGA e avança próxima.
    /// </summary>
    public async Task<StopTransitionResult> MarkSkippedAsync(Route route, Guid stopId, string? reason, CancellationToken ct = default)
    {
        if (route.Status != RouteStatus.EmAndamento)
            return StopTransitionResult.Fail("Rota precisa estar EmAndamento para ignorar paradas.");

        var stop = route.Stops.FirstOrDefault(s => s.Id == stopId);
        if (stop is null)
            return StopTransitionResult.Fail("Parada não encontrada.");

        if (IsFinalStopStatus(stop.Status))
            return StopTransitionResult.Fail($"Parada já está finalizada ({stop.Status}).");

        stop.Status = RouteStopStatus.Ignorada;
        if (!string.IsNullOrWhiteSpace(reason))
            stop.FailureReason = reason.Trim();

        // Reverte pedido para PRONTO_PARA_ENTREGA (consistente com MarkFailed e CancelRoute)
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == stop.OrderId, ct);
        if (order != null && order.Status == OrderStatus.SAIU_PARA_ENTREGA)
            order.Status = OrderStatus.PRONTO_PARA_ENTREGA;

        AdvanceNextStop(route);
        var allDone = CheckRouteCompletion(route);

        _logger.LogInformation("⏭️ Stop {StopId} ignorada na rota {RouteNumber}", stopId, route.RouteNumber);
        return StopTransitionResult.Ok(stop, allDone);
    }

    /// <summary>
    /// Versão síncrona mantida para compatibilidade — prefira MarkSkippedAsync.
    /// Não reverte o pedido (sem acesso ao DbContext de forma sync).
    /// </summary>
    public StopTransitionResult MarkSkipped(Route route, Guid stopId, string? reason)
    {
        if (route.Status != RouteStatus.EmAndamento)
            return StopTransitionResult.Fail("Rota precisa estar EmAndamento para ignorar paradas.");

        var stop = route.Stops.FirstOrDefault(s => s.Id == stopId);
        if (stop is null)
            return StopTransitionResult.Fail("Parada não encontrada.");

        if (IsFinalStopStatus(stop.Status))
            return StopTransitionResult.Fail($"Parada já está finalizada ({stop.Status}).");

        stop.Status = RouteStopStatus.Ignorada;
        if (!string.IsNullOrWhiteSpace(reason))
            stop.FailureReason = reason.Trim();

        AdvanceNextStop(route);
        var allDone = CheckRouteCompletion(route);

        _logger.LogInformation("⏭️ Stop {StopId} ignorada na rota {RouteNumber}", stopId, route.RouteNumber);
        return StopTransitionResult.Ok(stop, allDone);
    }

    private void AdvanceNextStop(Route route)
    {
        // Remove "Proxima" de qualquer stop
        foreach (var s in route.Stops)
        {
            if (s.Status == RouteStopStatus.Proxima)
                s.Status = RouteStopStatus.Pendente;
        }

        // Próxima pendente vira "Proxima"
        var next = route.Stops
            .Where(s => s.Status == RouteStopStatus.Pendente)
            .OrderBy(s => s.Sequence)
            .FirstOrDefault();

        if (next != null)
            next.Status = RouteStopStatus.Proxima;
    }

    private bool CheckRouteCompletion(Route route)
    {
        var allDone = route.Stops.All(s => IsFinalStopStatus(s.Status));
        if (allDone)
        {
            route.Status = RouteStatus.Concluida;
            route.CompletedAtUtc = DateTime.UtcNow;
            _logger.LogInformation("🏁 Rota {RouteNumber} concluída automaticamente", route.RouteNumber);
        }
        return allDone;
    }
}

public record StartRouteResult(bool Success, string? Error)
{
    public static StartRouteResult Ok() => new(true, null);
    public static StartRouteResult Fail(string error) => new(false, error);
}

public record StopTransitionResult(bool Success, string? Error, RouteStop? Stop, bool RouteCompleted)
{
    public static StopTransitionResult Ok(RouteStop stop, bool routeCompleted) => new(true, null, stop, routeCompleted);
    public static StopTransitionResult Fail(string error) => new(false, error, null, false);
}
