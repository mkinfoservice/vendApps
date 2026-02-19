namespace Petshop.Api.Contracts.Delivery;

public class DelivererResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Vehicle { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}