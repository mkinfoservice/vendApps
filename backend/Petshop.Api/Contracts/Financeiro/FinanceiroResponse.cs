namespace Petshop.Api.Contracts.Financeiro;

public record FinanceiroResponse(
    int Period,
    int TotalRevenueCents,
    int TotalDeliveries,
    int AvgPerDeliveryCents,
    int TotalFailures,
    List<DailyStatDto> DailyStats,
    List<DelivererCommissionDto> DelivererCommissions
);

public record DailyStatDto(
    string Date,
    int RevenueCents,
    int Deliveries,
    int Failures
);

public record DelivererCommissionDto(
    string DelivererName,
    int TotalDeliveries,
    int CommissionCents,
    int PerDeliveryCents
);
