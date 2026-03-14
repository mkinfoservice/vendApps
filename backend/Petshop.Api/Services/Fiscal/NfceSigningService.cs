using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Xml;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Assina o XML da NFC-e usando o certificado digital A1 (PFX/P12) da empresa.
/// Algoritmo: RSA-SHA1 (exigido pela SEFAZ para NF-e 4.00).
///
/// O elemento assinado é &lt;infNFe&gt; (atributo Id = "NFe{44}").
/// A assinatura fica como filho de &lt;NFe&gt;, após &lt;infNFe&gt;.
/// </summary>
public class NfceSigningService
{
    private readonly ILogger<NfceSigningService> _logger;

    public NfceSigningService(ILogger<NfceSigningService> logger) => _logger = logger;

    /// <summary>
    /// Assina o XML a partir de bytes do certificado (base64 já decodificado).
    /// Preferível ao overload de caminho de arquivo em ambientes cloud.
    /// </summary>
    public string Sign(string unsignedXml, byte[] certBytes, string certificatePassword)
    {
        var cert = new X509Certificate2(
            certBytes,
            certificatePassword,
            X509KeyStorageFlags.Exportable | X509KeyStorageFlags.MachineKeySet);

        return SignWithCert(unsignedXml, cert);
    }

    /// <summary>
    /// Assina o XML não-assinado retornado pelo NfceXmlBuilder.
    /// Retorna o XML completo com &lt;Signature&gt; embutido.
    /// </summary>
    public string Sign(string unsignedXml, string certificatePath, string certificatePassword)
    {
        // 1. Carrega certificado
        var cert = new X509Certificate2(
            certificatePath,
            certificatePassword,
            X509KeyStorageFlags.Exportable | X509KeyStorageFlags.MachineKeySet);

        return SignWithCert(unsignedXml, cert);
    }

    private string SignWithCert(string unsignedXml, X509Certificate2 cert)
    {

        using var rsa = cert.GetRSAPrivateKey()
            ?? throw new InvalidOperationException("Certificado não possui chave RSA privada.");

        // 2. Carrega XML
        var doc = new XmlDocument { PreserveWhitespace = false };
        doc.LoadXml(unsignedXml);

        // 3. Determina o Id do elemento infNFe
        var ns  = new XmlNamespaceManager(doc.NameTable);
        ns.AddNamespace("nfe", "http://www.portalfiscal.inf.br/nfe");
        var infNFe = doc.SelectSingleNode("//nfe:infNFe", ns) as XmlElement
            ?? throw new InvalidOperationException("Elemento infNFe não encontrado no XML.");

        var infNFeId = infNFe.GetAttribute("Id");

        // 4. Configura assinatura
        var signedXml = new SignedXml(doc) { SigningKey = rsa };

        var reference = new Reference("#" + infNFeId);
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        reference.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(cert));
        signedXml.KeyInfo = keyInfo;

        // 5. Assina
        signedXml.ComputeSignature();
        var signatureElement = signedXml.GetXml();

        // 6. Insere Signature como filho de NFe (após infNFe)
        var nfeNode = doc.SelectSingleNode("//nfe:NFe", ns) as XmlElement
            ?? doc.DocumentElement!;
        nfeNode.AppendChild(doc.ImportNode(signatureElement, true));

        _logger.LogDebug("[NfceSign] Assinatura RSA-SHA1 aplicada. Cert={Cert}", cert.Subject);

        return doc.OuterXml;
    }
}
