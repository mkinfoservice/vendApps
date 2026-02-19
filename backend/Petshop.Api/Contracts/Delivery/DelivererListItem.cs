namespace Petshop.Api.Contracts.Delivery;

public record DelivererListItem
(
    Guid Id,
    string Name,
    string Phone,
    string Vehicle,
    bool IsActive,
    DateTime CreatedAtUtc
);