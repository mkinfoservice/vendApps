namespace PrintAgent.Models;

public record PrintOrderPayload
{
    public Guid   OrderId        { get; init; }
    public string PublicId       { get; init; } = "";
    public string CustomerName   { get; init; } = "";
    public string Phone          { get; init; } = "";
    public string Address        { get; init; } = "";
    public string? Complement    { get; init; }
    public string Cep            { get; init; } = "";
    public string PaymentMethod  { get; init; } = "PIX";
    public int    TotalCents     { get; init; }
    public int    SubtotalCents  { get; init; }
    public int    DeliveryCents  { get; init; }
    public int?   CashGivenCents { get; init; }
    public int?   ChangeCents    { get; init; }
    public bool   IsPhoneOrder   { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public List<PrintItemPayload> Items { get; init; } = new();
}

public record PrintItemPayload
{
    public string Name      { get; init; } = "";
    public int    Qty       { get; init; }
    public int    UnitCents { get; init; }
}

public record PendingJobDto(Guid Id, string PublicId, string PrintPayloadJson, DateTime CreatedAtUtc);
