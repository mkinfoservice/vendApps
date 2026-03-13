using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Resultado da operação do motor fiscal (emissão, cancelamento, etc.).
/// Use os factory methods estáticos para criar instâncias.
/// </summary>
public class FiscalEngineResult
{
    public bool Success { get; init; }

    /// <summary>Chave de acesso de 44 dígitos retornada pelo SEFAZ.</summary>
    public string? AccessKey { get; init; }

    /// <summary>Protocolo de autorização retornado pelo SEFAZ.</summary>
    public string? Protocol { get; init; }

    /// <summary>XML completo assinado (gerado pelo ACBr).</summary>
    public string? XmlSigned { get; init; }

    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }

    public FiscalDocumentStatus Status { get; init; }

    // ── Factory methods ───────────────────────────────────────────────

    public static FiscalEngineResult Authorized(string accessKey, string protocol, string xml) => new()
    {
        Success = true,
        AccessKey = accessKey,
        Protocol = protocol,
        XmlSigned = xml,
        Status = FiscalDocumentStatus.Authorized
    };

    public static FiscalEngineResult Rejected(string code, string message) => new()
    {
        Success = false,
        ErrorCode = code,
        ErrorMessage = message,
        Status = FiscalDocumentStatus.Rejected
    };

    public static FiscalEngineResult InContingency(string? xml, string reason) => new()
    {
        Success = false,
        XmlSigned = xml,
        ErrorMessage = reason,
        Status = FiscalDocumentStatus.Contingency
    };
}
