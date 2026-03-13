using Microsoft.EntityFrameworkCore;
using Npgsql;
using Petshop.Api.Data;

namespace Petshop.Api.Services.Fiscal;

/// <summary>
/// Gerencia a numeração sequencial das NFC-e por empresa e série.
///
/// Usa INSERT ... ON CONFLICT DO UPDATE ... RETURNING atômico no PostgreSQL.
/// Thread-safe: o lock é feito no próprio banco de dados.
///
/// NUNCA chame GetNextNumberAsync() sem persistir o FiscalDocument logo em seguida —
/// números reservados e não usados causam lacunas na sequência (rejeição pela SEFAZ pode ocorrer).
/// </summary>
public class NfceNumberService
{
    private readonly AppDbContext _db;
    private readonly ILogger<NfceNumberService> _logger;

    public NfceNumberService(AppDbContext db, ILogger<NfceNumberService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Obtém e reserva atomicamente o próximo número de NFC-e para a empresa e série.
    /// Cria o registro de controle automaticamente se ainda não existir (primeira emissão).
    /// </summary>
    /// <returns>Número a ser gravado na NFC-e (começa em 1).</returns>
    public async Task<int> GetNextNumberAsync(Guid companyId, short serie)
    {
        var cs = _db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("String de conexão do banco não configurada.");

        await using var connection = new NpgsqlConnection(cs);
        await connection.OpenAsync();

        await using var cmd = new NpgsqlCommand("""
            INSERT INTO "NfceNumberControls" ("CompanyId", "Serie", "NextNumber", "LastUpdatedAt")
            VALUES (@companyId, @serie, 2, NOW())
            ON CONFLICT ("CompanyId", "Serie") DO UPDATE
                SET "NextNumber"     = "NfceNumberControls"."NextNumber" + 1,
                    "LastUpdatedAt"  = NOW()
            RETURNING "NextNumber" - 1
            """, connection);

        cmd.Parameters.AddWithValue("companyId", companyId);
        cmd.Parameters.AddWithValue("serie", serie);

        var result = await cmd.ExecuteScalarAsync()
            ?? throw new InvalidOperationException("Falha ao reservar número de NFC-e — resultado nulo.");

        var number = Convert.ToInt32(result);

        _logger.LogDebug(
            "[NfceNumber] Empresa {CompanyId} | série {Serie} | número reservado: {Number}",
            companyId, serie, number);

        return number;
    }

    /// <summary>
    /// Retorna o último número emitido para a empresa e série (somente leitura).
    /// Retorna 0 se ainda não houve nenhuma emissão.
    /// </summary>
    public async Task<int> GetLastIssuedNumberAsync(Guid companyId, short serie)
    {
        var record = await _db.NfceNumberControls.FindAsync(companyId, serie);
        return record is null ? 0 : record.NextNumber - 1;
    }
}
