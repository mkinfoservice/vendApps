namespace Petshop.Api.Contracts.Dashboard;

public record AdminDashboardResponse(
    OrderCountsDto Orders,
    RouteCountsDto Routes,
    DelivererStatsDto Deliverers,
    int ReadyOrdersWithCoords,
    int ReadyOrdersWithoutCoords,
    DateTime UpdatedAtUtc
);

public record OrderCountsDto(
    int Recebido,
    int EmPreparo,
    int ProntoParaEntrega,
    int SaiuParaEntrega,
    int Entregue,
    int Cancelado
);

public record RouteCountsDto(
    int Criada,
    int Atribuida,
    int EmAndamento,
    int Concluida,
    int Cancelada
);

public record DelivererStatsDto(
    int Total,
    int Active,
    int WithActiveRoute
);
