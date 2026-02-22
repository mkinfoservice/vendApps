namespace Petshop.Api.Contracts.Delivery;

public class UpdateDelivererRequest
{
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Vehicle { get; set; }
    public bool IsActive { get; set; } = true;
}