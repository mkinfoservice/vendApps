using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;

namespace Petshop.Api.Services.Customers;

/// <summary>
/// Protege CPFs em repouso (LGPD Art. 46):
///   • Encrypt/Decrypt via ASP.NET Core Data Protection (AES-256-CBC + HMAC-SHA256)
///   • Hash determinístico via HMACSHA256 com chave fixa para queries de igualdade
/// </summary>
public class CpfProtectionService
{
    private readonly IDataProtector _protector;
    private readonly byte[] _hmacKey;

    public CpfProtectionService(IDataProtectionProvider dpProvider, IConfiguration config)
    {
        _protector = dpProvider.CreateProtector("Cpf.v1");

        // Chave HMAC estável — usada para hashes de busca.
        // Configurar DataProtection__CpfHmacKey no Render para isolamento máximo.
        // Fallback: Jwt__Key (nunca fica vazio em produção).
        var raw = config["DataProtection:CpfHmacKey"] ?? config["Jwt:Key"] ?? "fallback-key";
        _hmacKey = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
    }

    /// <summary>Criptografa o CPF normalizado. Retorna null se cpf for null/vazio.</summary>
    public string? Protect(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        return _protector.Protect(cpf);
    }

    /// <summary>Descriptografa. Retorna null se falhar (dado legado plaintext ou chave diferente).</summary>
    public string? Unprotect(string? encrypted)
    {
        if (string.IsNullOrWhiteSpace(encrypted)) return null;
        // Se não começa com prefixo DP, é plaintext legado — retorna como está
        if (!encrypted.StartsWith("CfDJ8", StringComparison.Ordinal)) return encrypted;
        try { return _protector.Unprotect(encrypted); }
        catch { return null; }
    }

    /// <summary>Hash determinístico do CPF para queries de igualdade (busca por CPF).</summary>
    public string Hash(string cpf)
    {
        using var hmac = new HMACSHA256(_hmacKey);
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(cpf));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>True se o valor parece estar já criptografado pelo DP.</summary>
    public static bool IsProtected(string? value) =>
        value != null && value.StartsWith("CfDJ8", StringComparison.Ordinal);
}
