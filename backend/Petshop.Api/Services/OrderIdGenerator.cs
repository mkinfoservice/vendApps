namespace Petshop.Api.Services;

public static class OrderIdGenerator
{
    public static string NewPublicId()
    {
        var date = DateTime.UtcNow.ToString("yyyyMMdd");
        var rnd = Random.Shared.Next(0, 999999).ToString("D6");
        return $"PS-{date}-{rnd}";
    }
}