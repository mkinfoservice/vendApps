namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Controla a numeração sequencial de NFC-e por empresa e série.
/// PK composta: (CompanyId + Serie).
///
/// IMPORTANTE: NUNCA calcule o próximo número com MAX() + 1.
/// Sempre use NfceNumberService.GetNextNumberAsync() que faz UPDATE RETURNING atômico
/// no PostgreSQL, garantindo unicidade mesmo sob concorrência.
/// </summary>
public class NfceNumberControl
{
    /// <summary>Empresa emissora.</summary>
    public Guid CompanyId { get; set; }

    /// <summary>Série da NFC-e (1 a 999).</summary>
    public short Serie { get; set; }

    /// <summary>
    /// Próximo número a ser emitido.
    /// Incrementado atomicamente via SQL: UPDATE ... SET NextNumber = NextNumber + 1 RETURNING NextNumber - 1
    /// </summary>
    public int NextNumber { get; set; } = 1;

    public DateTime? LastUpdatedAt { get; set; }
}
