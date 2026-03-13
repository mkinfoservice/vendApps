using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Gera o XML não-assinado da NFC-e (modelo 65, versão 4.00) conforme NT 2013.001.
/// Tributação Simples Nacional (CRT=1, CSOSN=400) e Lucro Presumido (CRT=3, CST=102/41).
///
/// Retorna o XML da &lt;NFe&gt; pronto para ser assinado pelo NfceSigningService.
/// </summary>
public static class NfceXmlBuilder
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    // ── Public entry point ────────────────────────────────────────────────────

    public static (string UnsignedXml, string AccessKey) Build(FiscalDocumentRequest req)
    {
        var uf     = req.Emitter.Uf;
        var ufCode = SefazEndpoints.UfToCode(uf);
        var tpAmb  = req.Emitter.SefazEnvironment == SefazEnvironment.Producao ? "1" : "2";
        var serie  = req.Serie.ToString().PadLeft(3, '0');
        var nNF    = req.Number.ToString().PadLeft(9, '0');
        var tpEmis = req.ContingencyType switch
        {
            ContingencyType.SvcAn => "7",
            ContingencyType.SvcRs => "8",
            _                     => "1",
        };

        var aamm   = req.SaleDateTimeUtc.ToString("yyMM", Inv);
        var cnpj   = req.Emitter.Cnpj.PadLeft(14, '0');
        var cNF    = Random.Shared.Next(10_000_000, 99_999_999).ToString();
        var prefix = $"{ufCode}{aamm}{cnpj}65{serie}{nNF}{tpEmis}{cNF}";
        var cDv    = CalcCheckDigit(prefix);
        var accessKey = prefix + cDv;
        var infNFeId  = "NFe" + accessKey;

        var dhEmi = (req.SaleDateTimeUtc - TimeSpan.FromHours(3)).ToString("yyyy-MM-ddTHH:mm:ss", Inv) + "-03:00";

        var em = req.Emitter;
        var vNF  = (req.TotalCents / 100m).ToString("F2", Inv);
        var vDesc = (req.DiscountCents / 100m).ToString("F2", Inv);
        var vProd = ((req.SubtotalCents) / 100m).ToString("F2", Inv);

        var detXml  = BuildDet(req, em.DefaultCfop, em.TaxRegime);
        var pagXml  = BuildPag(req.Payments);
        var (qrCode, urlChave) = BuildQrCode(accessKey, tpAmb, em);

        var crt = em.TaxRegime switch
        {
            TaxRegime.SimplesNacional => "1",
            TaxRegime.LucroPresumido  => "3",
            TaxRegime.LucroReal       => "3",
            _                         => "1",
        };

        // contingência
        var contingXml = req.ContingencyType != ContingencyType.None
            ? $"<dhCont>{dhEmi}</dhCont><xJust>Contingência: sem comunicação com SEFAZ.</xJust>"
            : "";

        var telEmit  = string.IsNullOrWhiteSpace(em.Telefone) ? "" : $"<fone>{em.Telefone}</fone>";
        var fantEmit = string.IsNullOrWhiteSpace(em.NomeFantasia) ? "" : $"<xFant>{Esc(em.NomeFantasia)}</xFant>";
        var compEnd  = string.IsNullOrWhiteSpace(em.Complemento) ? "" : $"<xCpl>{Esc(em.Complemento)}</xCpl>";

        var nfeXml = $@"<NFe xmlns=""http://www.portalfiscal.inf.br/nfe""><infNFe versao=""4.00"" Id=""{infNFeId}""><ide><cUF>{ufCode}</cUF><cNF>{cNF}</cNF><natOp>VENDA AO CONSUMIDOR</natOp><mod>65</mod><serie>{req.Serie}</serie><nNF>{req.Number}</nNF><dhEmi>{dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>{em.CodigoMunicipio}</cMunFG><tpImp>4</tpImp><tpEmis>{tpEmis}</tpEmis><cDV>{cDv}</cDV><tpAmb>{tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><indIntermed>0</indIntermed><procEmi>0</procEmi><verProc>vendApps 5.0</verProc>{contingXml}</ide><emit><CNPJ>{cnpj}</CNPJ><xNome>{Esc(em.RazaoSocial)}</xNome>{fantEmit}<enderEmit><xLgr>{Esc(em.Logradouro)}</xLgr><nro>{Esc(em.NumeroEndereco)}</nro>{compEnd}<xBairro>{Esc(em.Bairro)}</xBairro><cMun>{em.CodigoMunicipio}</cMun><xMun>{Esc(em.NomeMunicipio)}</xMun><UF>{uf}</UF><CEP>{em.Cep}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais>{telEmit}</enderEmit><IE>{Esc(em.InscricaoEstadual)}</IE><CRT>{crt}</CRT></emit>{detXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCPUFDest>0.00</vFCPUFDest><vICMSUFDest>0.00</vICMSUFDest><vICMSUFRemet>0.00</vICMSUFRemet><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>{vProd}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>{vDesc}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>{vNF}</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp>{pagXml}<infAdic><infCpl>Obrigado pela preferencia!</infCpl></infAdic><infNFeSupl><qrCode>{qrCode}</qrCode><urlChave>{urlChave}</urlChave></infNFeSupl></infNFe></NFe>";

        return (nfeXml, accessKey);
    }

    // ── Det (items) ───────────────────────────────────────────────────────────

    private static string BuildDet(FiscalDocumentRequest req, string defaultCfop, TaxRegime taxRegime)
    {
        var sb = new StringBuilder();
        var isSimples = taxRegime == TaxRegime.SimplesNacional;

        foreach (var item in req.Items)
        {
            var cfop     = defaultCfop.PadLeft(4, '5');
            var ncm      = string.IsNullOrWhiteSpace(item.Ncm) ? "00000000" : item.Ncm.Replace(".", "").PadLeft(8, '0');
            var barcode  = string.IsNullOrWhiteSpace(item.Barcode) ? "SEM GTIN" : item.Barcode;
            var uCom     = item.IsSoldByWeight ? "KG" : (item.Unit ?? "UN");
            var qCom     = item.Quantity.ToString("F4", Inv);
            var vUnCom   = (item.UnitPriceCents / 100m).ToString("F10", Inv).TrimEnd('0').TrimEnd('.');
            if (!vUnCom.Contains('.')) vUnCom += ".00";
            var vProd    = (item.TotalCents / 100m).ToString("F2", Inv);
            var cProd    = string.IsNullOrWhiteSpace(item.ProductCode) ? $"{item.ItemNumber:D5}" : item.ProductCode[..Math.Min(60, item.ProductCode.Length)];

            var icmsXml = isSimples
                ? "<ICMS><ICMSSN400><orig>0</orig><CSOSN>400</CSOSN></ICMSSN400></ICMS>"
                : "<ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>";

            sb.Append($@"<det nItem=""{item.ItemNumber}""><prod><cProd>{Esc(cProd)}</cProd><cEAN>{barcode}</cEAN><xProd>{Esc(item.ProductName)}</xProd><NCM>{ncm}</NCM><CFOP>{cfop}</CFOP><uCom>{uCom}</uCom><qCom>{qCom}</qCom><vUnCom>{vUnCom}</vUnCom><vProd>{vProd}</vProd><cEANTrib>{barcode}</cEANTrib><uTrib>{uCom}</uTrib><qTrib>{qCom}</qTrib><vUnTrib>{vUnCom}</vUnTrib><indTot>1</indTot></prod><imposto>{icmsXml}<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det>");
        }

        return sb.ToString();
    }

    // ── Pag (payments) ────────────────────────────────────────────────────────

    private static string BuildPag(IReadOnlyList<FiscalPaymentData> payments)
    {
        var sb      = new StringBuilder("<pag>");
        var troco   = payments.Sum(p => p.ChangeCents);
        var trocoFmt = (troco / 100m).ToString("F2", Inv);

        foreach (var p in payments)
        {
            var tPag = MapPayMethod(p.PaymentMethod);
            var vPag = (p.AmountCents / 100m).ToString("F2", Inv);
            sb.Append($"<detPag><indPag>0</indPag><tPag>{tPag}</tPag><vPag>{vPag}</vPag></detPag>");
        }

        if (troco > 0)
            sb.Append($"<vTroco>{trocoFmt}</vTroco>");

        sb.Append("</pag>");
        return sb.ToString();
    }

    private static string MapPayMethod(string method) => method.ToUpperInvariant() switch
    {
        "DINHEIRO" or "CASH"          => "01",
        "CARTAO_CREDITO" or "CREDITO" => "03",
        "CARTAO_DEBITO"  or "DEBITO"  => "04",
        "PIX"                         => "17",
        "CHEQUE" or "CHECK"           => "02",
        _                             => "99",
    };

    // ── QR Code ───────────────────────────────────────────────────────────────

    private static (string qrCode, string urlChave) BuildQrCode(
        string accessKey, string tpAmb, EmitterData em)
    {
        var qrBase = SefazEndpoints.GetQrCodeBaseUrl(em.Uf, em.SefazEnvironment);

        string qrUrl;
        if (!string.IsNullOrWhiteSpace(em.CscId) && !string.IsNullOrWhiteSpace(em.CscToken))
        {
            // Hash = SHA1( chave + cIdToken + cToken )
            var input = accessKey + em.CscId.PadLeft(6, '0') + em.CscToken;
            var hash  = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
            qrUrl = $"{qrBase}?p={accessKey}|{tpAmb}|{hash}|{em.CscId}";
        }
        else
        {
            // Sem CSC — QR code sem assinatura (funciona em homologação)
            qrUrl = $"{qrBase}?p={accessKey}|{tpAmb}";
        }

        // URL de consulta da chave
        var urlChave = $"https://nfce.fazenda.{em.Uf.ToLowerInvariant()}.gov.br/consultaRecaptcha?chave={accessKey}";

        return (qrUrl, urlChave);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string CalcCheckDigit(string key43)
    {
        var weights = new[] { 2, 3, 4, 5, 6, 7, 8, 9 };
        var sum = 0;
        for (int i = key43.Length - 1, w = 0; i >= 0; i--, w = (w + 1) % 8)
            sum += int.Parse(key43[i].ToString()) * weights[w];
        var rem = sum % 11;
        return (rem < 2 ? 0 : 11 - rem).ToString();
    }

    /// <summary>Escapa caracteres especiais XML.</summary>
    private static string Esc(string? s) =>
        (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
}
