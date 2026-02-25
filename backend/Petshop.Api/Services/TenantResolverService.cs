using System.Text.RegularExpressions;

namespace Petshop.Api.Services;

/// <summary>
/// Extrai e valida o slug do tenant a partir do Host header.
/// Configurável via TENANT_BASE_DOMAIN (padrão: "vendapps.com.br").
/// </summary>
public partial class TenantResolverService
{
    private readonly string _baseDomain;

    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "app", "admin", "api", "master", "suporte", "blog", "help", "status"
    };

    [GeneratedRegex(@"^[a-z0-9-]{3,63}$")]
    private static partial Regex SlugPattern();

    public TenantResolverService(IConfiguration configuration)
    {
        _baseDomain = (configuration["TENANT_BASE_DOMAIN"] ?? "vendapps.com.br").ToLowerInvariant().Trim('.');
    }

    /// <summary>
    /// Valida um slug diretamente (sem Host header).
    /// Retorna null se válido, ou a mensagem de erro se inválido.
    /// </summary>
    public string? ValidateSlug(string? slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            return "Slug é obrigatório.";

        var s = slug.Trim().ToLowerInvariant();

        if (!SlugPattern().IsMatch(s))
            return "Slug inválido. Use apenas letras minúsculas, números e hífens (3–63 caracteres).";

        if (ReservedSlugs.Contains(s))
            return $"Slug '{s}' é reservado e não pode ser utilizado.";

        return null; // válido
    }

    /// <summary>
    /// Extrai o slug do tenant do valor do Host header.
    /// Retorna null se o host for o domínio apex, reservado, inválido ou não pertencer ao base domain.
    /// </summary>
    public string? ExtractSlug(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
            return null;

        // Remove porta (ex: "minhaloja.vendapps.com.br:443" → "minhaloja.vendapps.com.br")
        var h = host.Split(':')[0].Trim().ToLowerInvariant();

        // Domínio apex → sem tenant
        if (string.Equals(h, _baseDomain, StringComparison.OrdinalIgnoreCase))
            return null;

        // Deve terminar com ".<baseDomain>"
        var suffix = "." + _baseDomain;
        if (!h.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            return null;

        // Extrai apenas o primeiro nível de subdomínio
        var subdomain = h[..^suffix.Length];

        // Não aceita sub.sub (ex: a.b.vendapps.com.br)
        if (subdomain.Contains('.'))
            return null;

        // Valida formato do slug
        if (!SlugPattern().IsMatch(subdomain))
            return null;

        // Bloqueia slugs reservados
        if (ReservedSlugs.Contains(subdomain))
            return null;

        return subdomain;
    }
}
