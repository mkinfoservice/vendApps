namespace Petshop.Api.Services.Dav;

public static class DavPublicIdGenerator
{
    public static string NewPublicId()
    {
        var date = DateTime.UtcNow.ToString("yyyyMMdd");
        var rnd  = Random.Shared.Next(0, 999999).ToString("D6");
        return $"DAV-{date}-{rnd}";
    }
}
