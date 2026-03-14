using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Motor fiscal real: gera o XML da NFC-e, assina com certificado A1 e transmite à SEFAZ.
/// Registrado no DI quando FiscalConfig está ativa e com certificado configurado.
/// Fallback: MockFiscalEngine (mantido no DI como default).
/// </summary>
public class RealFiscalEngine : IFiscalEngine
{
    private readonly NfceSigningService          _signer;
    private readonly SefazHttpClient             _sefaz;
    private readonly ILogger<RealFiscalEngine>   _logger;

    public RealFiscalEngine(
        NfceSigningService        signer,
        SefazHttpClient           sefaz,
        ILogger<RealFiscalEngine> logger)
    {
        _signer = signer;
        _sefaz  = sefaz;
        _logger = logger;
    }

    public async Task<FiscalEngineResult> IssueAsync(FiscalDocumentRequest req, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "[RealFiscalEngine] Emitindo NFC-e #{Number}/série {Serie} — SaleOrder {SaleId}.",
            req.Number, req.Serie, req.SaleOrderId);

        try
        {
            // IssueAsync é chamado apenas pelo MockFiscalEngine path ou quando não há certificado.
            // Com certificado, usar IssueWithCertAsync diretamente.
            var (unsignedXml, accessKey) = NfceXmlBuilder.Build(req);
            return await TransmitAsync(req, unsignedXml, accessKey, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[RealFiscalEngine] Falha ao emitir NFC-e.");
            return FiscalEngineResult.InContingency("", ex.Message);
        }
    }

    /// <summary>Assina com bytes do certificado (base64 decodificado) e transmite à SEFAZ.</summary>
    internal async Task<FiscalEngineResult> IssueWithCertAsync(
        FiscalDocumentRequest req,
        byte[] certBytes,
        string? certPassword,
        CancellationToken ct)
    {
        var (unsignedXml, accessKey) = NfceXmlBuilder.Build(req);
        var signedXml = _signer.Sign(unsignedXml, certBytes, certPassword ?? "");
        return await TransmitAsync(req, signedXml, accessKey, ct);
    }

    /// <summary>Assina com caminho de arquivo (legado) e transmite à SEFAZ.</summary>
    internal async Task<FiscalEngineResult> IssueWithCertAsync(
        FiscalDocumentRequest req,
        string? certPath,
        string? certPassword,
        CancellationToken ct)
    {
        var (unsignedXml, accessKey) = NfceXmlBuilder.Build(req);

        string signedXml;
        if (!string.IsNullOrWhiteSpace(certPath) && File.Exists(certPath))
        {
            signedXml = _signer.Sign(unsignedXml, certPath, certPassword ?? "");
        }
        else
        {
            _logger.LogWarning("[RealFiscalEngine] Certificado não encontrado em {Path}. " +
                               "Transmitindo sem assinatura (apenas homologação).", certPath);
            signedXml = unsignedXml;
        }

        return await TransmitAsync(req, signedXml, accessKey, ct);
    }

    private async Task<FiscalEngineResult> TransmitAsync(
        FiscalDocumentRequest req, string xml, string accessKey, CancellationToken ct)
    {
        var result = await _sefaz.AuthorizeAsync(
            req.Emitter.Uf,
            req.Emitter.SefazEnvironment,
            xml,
            req.Serie,
            ct);

        if (result.Success)
        {
            _logger.LogInformation(
                "[RealFiscalEngine] Autorizada. Chave={Key} | Protocolo={Prot}",
                result.AccessKey, result.Protocol);

            return FiscalEngineResult.Authorized(result.AccessKey!, result.Protocol!, xml);
        }

        if (result.IsNetworkError)
        {
            _logger.LogWarning("[RealFiscalEngine] Sem comunicação com SEFAZ — contingência.");
            return FiscalEngineResult.InContingency(xml, result.RejectMessage ?? "Sem comunicação");
        }

        _logger.LogWarning(
            "[RealFiscalEngine] Rejeitada. cStat={Code} | {Msg}",
            result.RejectCode, result.RejectMessage);

        return FiscalEngineResult.Rejected(result.RejectCode!, result.RejectMessage!);
    }

    public async Task<FiscalEngineResult> CancelAsync(
        string accessKey,
        string reason,
        CancellationToken ct = default)
    {
        // Cancelamento NFC-e requer evento fiscal (NFeEventoCancNFe4)
        // Implementação completa na próxima iteração
        _logger.LogWarning("[RealFiscalEngine] Cancelamento ainda não implementado para NFC-e.");
        return FiscalEngineResult.Rejected("999", "Cancelamento não implementado.");
    }

    public async Task<bool> IsSefazOnlineAsync(string uf, CancellationToken ct = default)
    {
        // Usa a config padrão — pega ambiente do config
        // Para verificação pública, usa homologação
        return await _sefaz.IsOnlineAsync(uf, SefazEnvironment.Homologacao, ct);
    }
}
