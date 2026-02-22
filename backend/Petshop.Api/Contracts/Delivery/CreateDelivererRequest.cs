namespace Petshop.Api.Contracts.Delivery;

public class CreateDelivererRequest
{
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Vehicle { get; set; }
    public string Pin { get; set; } = "";
    public bool IsActive { get; set; } = true;
}