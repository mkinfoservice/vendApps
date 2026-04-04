using Microsoft.AspNetCore.DataProtection;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Protege certificados digitais e senhas fiscais em repouso.
/// CertificateBase64 e CertificatePassword são criptografados com AES-256
/// via ASP.NET Core Data Protection.
/// </summary>
public class FiscalCertProtectionService
{
    private readonly IDataProtector _protector;

    public FiscalCertProtectionService(IDataProtectionProvider dpProvider)
    {
        _protector = dpProvider.CreateProtector("FiscalCert.v1");
    }

    /// <summary>Criptografa. Retorna null se value for null/vazio.</summary>
    public string? Protect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return _protector.Protect(value);
    }

    /// <summary>
    /// Descriptografa. Retorna null se value for null.
    /// Se o valor não começar com o prefixo DP, é plaintext legado — retorna como está.
    /// </summary>
    public string? Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!value.StartsWith("CfDJ8", StringComparison.Ordinal)) return value;
        try { return _protector.Unprotect(value); }
        catch { return null; }
    }

    public static bool IsProtected(string? value) =>
        value != null && value.StartsWith("CfDJ8", StringComparison.Ordinal);
}
