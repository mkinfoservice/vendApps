namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Abstração do motor fiscal.
/// Implementações disponíveis:
///   - MockFiscalEngine  → desenvolvimento e testes (registrado por padrão)
///   - AcbrFiscalEngine  → produção, via ACBr Monitor Plus (Fase 5)
///
/// Trocar a implementação em Program.cs não exige refatoração de nenhum módulo de negócio.
/// </summary>
public interface IFiscalEngine
{
    /// <summary>Emite um documento fiscal (NFC-e/NFe) para o SEFAZ.</summary>
    Task<FiscalEngineResult> IssueAsync(FiscalDocumentRequest request, CancellationToken ct = default);

    /// <summary>Cancela um documento fiscal previamente autorizado.</summary>
    Task<FiscalEngineResult> CancelAsync(string accessKey, string reason, CancellationToken ct = default);

    /// <summary>Verifica se o SEFAZ do UF informado está respondendo.</summary>
    Task<bool> IsSefazOnlineAsync(string uf, CancellationToken ct = default);
}
