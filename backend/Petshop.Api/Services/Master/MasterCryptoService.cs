using Microsoft.AspNetCore.DataProtection;

namespace Petshop.Api.Services.Master;

/// <summary>
/// Criptografia de dados sensíveis do Master Admin usando ASP.NET Core Data Protection.
/// Usado atualmente para o AccessToken da integração WhatsApp Cloud API.
/// </summary>
public class MasterCryptoService
{
    private readonly IDataProtector _protector;

    public MasterCryptoService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Master.WhatsApp.AccessToken");
    }

    public string Encrypt(string plainText) => _protector.Protect(plainText);

    /// <summary>Retorna null se o cipherText for null ou se a descriptografia falhar.</summary>
    public string? TryDecrypt(string? cipherText)
    {
        if (cipherText is null) return null;
        try { return _protector.Unprotect(cipherText); }
        catch { return null; }
    }
}
