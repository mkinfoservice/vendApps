namespace Petshop.Api.Contracts.Delivery.DelivererPortal;

public class DelivererRouteDetailResponse
{
    public Guid RouteId { get; set; }
    public string RouteNumber { get; set; } = "";
    public string Status { get; set; } = "";
    public int TotalStops { get; set; }
    public int CompletedStops { get; set; }
    public Guid? NextStopId { get; set; }
    public DelivererStopDto? NextStop { get; set; }
    public List<DelivererStopDto> Stops { get; set; } = new();
    public DelivererDepotInfo? Depot { get; set; }
    public DelivererProgressInfo Progress { get; set; } = new();
}

public class DelivererStopDto
{
    public Guid StopId { get; set; }
    public int Sequence { get; set; }
    public string OrderNumber { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Status { get; set; } = "";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? DeliveredAtUtc { get; set; }
    public string? FailureReason { get; set; }
}

public class DelivererDepotInfo
{
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
}

public class DelivererProgressInfo
{
    public int Done { get; set; }
    public int Total { get; set; }
}
