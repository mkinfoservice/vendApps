using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Implementação mock do motor fiscal para desenvolvimento e testes.
/// Simula autorização imediata sem comunicação real com o SEFAZ.
/// Para produção: substituir por AcbrFiscalEngine em Program.cs (Fase 5).
/// </summary>
public class MockFiscalEngine : IFiscalEngine
{
    private readonly ILogger<MockFiscalEngine> _logger;

    public MockFiscalEngine(ILogger<MockFiscalEngine> logger)
    {
        _logger = logger;
    }

    public Task<FiscalEngineResult> IssueAsync(FiscalDocumentRequest request, CancellationToken ct = default)
    {
        var fakeKey = GenerateFakeAccessKey(request);
        var fakeProtocol = $"MOCK-{DateTime.UtcNow:yyyyMMddHHmmss}-{request.Number:D9}";

        _logger.LogInformation(
            "[MockFiscalEngine] Emissão simulada | empresa {CompanyId} | série {Serie} | nº {Number} | chave {Key}",
            request.CompanyId, request.Serie, request.Number, fakeKey);

        return Task.FromResult(FiscalEngineResult.Authorized(fakeKey, fakeProtocol, "<nfce-mock/>"));
    }

    public Task<FiscalEngineResult> CancelAsync(string accessKey, string reason, CancellationToken ct = default)
    {
        _logger.LogInformation("[MockFiscalEngine] Cancelamento simulado | chave {Key} | motivo: {Reason}",
            accessKey, reason);

        return Task.FromResult(FiscalEngineResult.Authorized(accessKey, "MOCK-CANCEL", "<cancel-mock/>"));
    }

    public Task<bool> IsSefazOnlineAsync(string uf, CancellationToken ct = default)
    {
        _logger.LogDebug("[MockFiscalEngine] SEFAZ mock online para UF {Uf}", uf);
        return Task.FromResult(true);
    }

    /// <summary>
    /// Gera uma chave de acesso fake de 44 dígitos.
    /// NÃO é válida para o SEFAZ — somente para testes locais.
    /// </summary>
    private static string GenerateFakeAccessKey(FiscalDocumentRequest request)
    {
        var rand = new Random();
        var cUF = "35"; // SP como placeholder
        var aamm = DateTime.UtcNow.ToString("yyMM");
        var cnpj = "00000000000000";
        var mod = "65"; // NFC-e
        var serie = request.Serie.ToString("D3");
        var nNF = request.Number.ToString("D9");
        var tpEmis = "1";
        var cNF = rand.Next(10000000, 99999999).ToString();
        var raw = $"{cUF}{aamm}{cnpj}{mod}{serie}{nNF}{tpEmis}{cNF}";
        return raw.PadRight(43, '0') + "0"; // dígito verificador fake = 0
    }
}
