namespace Petshop.Api.Contracts.Delivery;

public class CreateRouteResponse
{
    public Guid RouteId { get; set; }
    public string RouteNumber { get; set; } = "";
    public int TotalStops { get; set; }
    
    public List<RouteStopDto> Stops { get; set; } = new();
}

public class RouteStopDto
{
    public Guid StopId { get; set;}
    public int Sequence { get; set; }
    public string OrderNumber { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Status { get; set; } = "";
}