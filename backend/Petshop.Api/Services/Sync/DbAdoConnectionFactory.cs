using System.Data.Common;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Cria conexões ADO.NET para os diferentes providers suportados.
/// </summary>
internal static class DbAdoConnectionFactory
{
    public static DbConnection Create(DbConnectionConfig config)
    {
        return (config.Provider ?? "").ToLowerInvariant() switch
        {
            "mysql" or "mariadb"       => new MySqlConnector.MySqlConnection(config.ConnectionString),
            "sqlserver"                => new Microsoft.Data.SqlClient.SqlConnection(config.ConnectionString),
            "firebird"                 => new FirebirdSql.Data.FirebirdClient.FbConnection(config.ConnectionString),
            "postgres" or "postgresql" => new Npgsql.NpgsqlConnection(config.ConnectionString),
            _ => throw new NotSupportedException($"Provider '{config.Provider}' não suportado. Use: MySql, Postgres, SqlServer ou Firebird.")
        };
    }
}
