namespace Petshop.Api.Services.Sync;

public class ProviderCapabilities
{
    /// <summary>Suporta busca incremental por UpdatedSince.</summary>
    public bool SupportsDelta { get; set; }

    /// <summary>Fornece hash do registro para comparação sem re-fetch.</summary>
    public bool SupportsHashCheck { get; set; }

    /// <summary>Fornece URLs de imagens junto com os produtos.</summary>
    public bool SupportsImages { get; set; }
}
