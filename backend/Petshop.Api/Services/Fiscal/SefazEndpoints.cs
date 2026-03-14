using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Tabela de URLs dos web services SEFAZ por UF e ambiente.
/// Estados sem URL própria usam SVC-AN (Sefaz Virtual Nacional) como fallback.
/// </summary>
public static class SefazEndpoints
{
    private static readonly Dictionary<string, (string Prod, string Homolog)> AuthUrls = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SP"] = ("https://nfce.sefaz.sp.gov.br/ws/NFeAutorizacao4.asmx",
                  "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx"),
        ["MG"] = ("https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4",
                  "https://hnfce.fazenda.mg.gov.br/nfce-hom/services/NFeAutorizacao4"),
        ["RJ"] = ("https://nfce.fazenda.rj.gov.br/ws/NFeAutorizacao4.asmx",
                  "https://nfce.fazenda.rj.gov.br/ws-hom/NFeAutorizacao4.asmx"),
        ["PR"] = ("https://app.sefaz.pr.gov.br/wsNFCe/NFeAutorizacao4.asmx",
                  "https://homologacao.nfce.sefa.pr.gov.br/wsNFCe/NFeAutorizacao4.asmx"),
        ["RS"] = ("https://nfce.sefaz.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx",
                  "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NFeAutorizacao4/NFeAutorizacao4.asmx"),
        ["GO"] = ("https://nfce.sefaz.go.gov.br/nfeweb/services/NFeAutorizacao4.asmx",
                  "https://homologacao.nfe.go.gov.br/nfeweb/services/NFeAutorizacao4.asmx"),
        ["BA"] = ("https://nfce.sefaz.ba.gov.br/webservices-nfce/NFeAutorizacao4",
                  "https://hnfce.sefaz.ba.gov.br/webservices-nfce/NFeAutorizacao4"),
        ["MT"] = ("https://nfce.sefaz.mt.gov.br/ws/NFeAutorizacao4.asmx",
                  "https://homologacao.nfce.sefaz.mt.gov.br/ws/NFeAutorizacao4.asmx"),
    };

    private const string SvcAnProd   = "https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx";
    private const string SvcAnHomolog = "https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx";

    private static readonly Dictionary<string, (string Prod, string Homolog)> StatusUrls = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SP"] = ("https://nfce.sefaz.sp.gov.br/ws/NFeStatusServico4.asmx",
                  "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx"),
        ["RJ"] = ("https://nfce.fazenda.rj.gov.br/ws/NFeStatusServico4.asmx",
                  "https://nfce.fazenda.rj.gov.br/ws-hom/NFeStatusServico4.asmx"),
        ["MG"] = ("https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4",
                  "https://hnfce.fazenda.mg.gov.br/nfce-hom/services/NFeStatusServico4"),
        ["PR"] = ("https://app.sefaz.pr.gov.br/wsNFCe/NFeStatusServico4.asmx",
                  "https://homologacao.nfce.sefa.pr.gov.br/wsNFCe/NFeStatusServico4.asmx"),
        ["RS"] = ("https://nfce.sefaz.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx",
                  "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NFeStatusServico4/NFeStatusServico4.asmx"),
        ["BA"] = ("https://nfce.sefaz.ba.gov.br/webservices-nfce/NFeStatusServico4",
                  "https://hnfce.sefaz.ba.gov.br/webservices-nfce/NFeStatusServico4"),
        ["GO"] = ("https://nfce.sefaz.go.gov.br/nfeweb/services/NFeStatusServico4.asmx",
                  "https://homologacao.nfe.go.gov.br/nfeweb/services/NFeStatusServico4.asmx"),
    };

    private const string SvcAnStatusProd   = "https://www.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx";
    private const string SvcAnStatusHomolog = "https://hom.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx";

    private static readonly Dictionary<string, (string Prod, string Homolog)> QrCodeUrls = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SP"] = ("https://www.nfce.fazenda.sp.gov.br/qrcode",
                  "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode"),
        ["MG"] = ("https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
                  "https://hnfce.fazenda.mg.gov.br/portalnfce-hom/sistema/qrcode.xhtml"),
        ["RS"] = ("https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
                  "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx"),
    };

    private const string SvcAnQrCodeProd   = "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=consultaNFCe&tipoConteudo=XbSeqxE8pl8=";
    private const string SvcAnQrCodeHomolog = "https://hom.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=consultaNFCe&tipoConteudo=XbSeqxE8pl8=";

    // ── Public API ────────────────────────────────────────────────────────────

    public static string GetAuthUrl(string uf, SefazEnvironment env)
    {
        var isProd = env == SefazEnvironment.Producao;
        if (AuthUrls.TryGetValue(uf, out var pair))
            return isProd ? pair.Prod : pair.Homolog;
        return isProd ? SvcAnProd : SvcAnHomolog;
    }

    public static string GetStatusUrl(string uf, SefazEnvironment env)
    {
        var isProd = env == SefazEnvironment.Producao;
        if (StatusUrls.TryGetValue(uf, out var pair))
            return isProd ? pair.Prod : pair.Homolog;
        return isProd ? SvcAnStatusProd : SvcAnStatusHomolog;
    }

    public static string GetQrCodeBaseUrl(string uf, SefazEnvironment env)
    {
        var isProd = env == SefazEnvironment.Producao;
        if (QrCodeUrls.TryGetValue(uf, out var pair))
            return isProd ? pair.Prod : pair.Homolog;
        return isProd ? SvcAnQrCodeProd : SvcAnQrCodeHomolog;
    }

    /// <summary>Retorna código numérico IBGE da UF (cUF).</summary>
    public static string UfToCode(string uf) => uf.ToUpperInvariant() switch
    {
        "AC" => "12", "AL" => "27", "AM" => "13", "AP" => "16",
        "BA" => "29", "CE" => "23", "DF" => "53", "ES" => "32",
        "GO" => "52", "MA" => "21", "MG" => "31", "MS" => "50",
        "MT" => "51", "PA" => "15", "PB" => "25", "PE" => "26",
        "PI" => "22", "PR" => "41", "RJ" => "33", "RN" => "24",
        "RO" => "11", "RR" => "14", "RS" => "43", "SC" => "42",
        "SE" => "28", "SP" => "35", "TO" => "17",
        _ => "35"
    };
}
