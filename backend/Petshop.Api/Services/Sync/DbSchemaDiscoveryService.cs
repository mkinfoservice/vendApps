using System.Data.Common;
using System.Text;
using System.Text.RegularExpressions;

namespace Petshop.Api.Services.Sync;

public record DbTableInfo(string TableName, long? RowCount);
public record DbColumnInfo(string ColumnName, string DataType, bool IsNullable, List<string> SampleValues);

/// <summary>
/// Descobre o schema de bancos de dados externos (tabelas e colunas com amostras).
/// Suporta conexão live e modo dump (.sql).
/// </summary>
public class DbSchemaDiscoveryService
{
    // ────────────────────────────────────────────────────────────────────────
    // Tabelas
    // ────────────────────────────────────────────────────────────────────────

    public async Task<List<DbTableInfo>> GetTablesAsync(DbConnectionConfig config, CancellationToken ct)
    {
        if (string.Equals(config.Mode, "dump", StringComparison.OrdinalIgnoreCase))
            return await GetTablesFromDumpAsync(config, ct);

        return await GetTablesFromLiveAsync(config, ct);
    }

    private async Task<List<DbTableInfo>> GetTablesFromLiveAsync(DbConnectionConfig config, CancellationToken ct)
    {
        var provider = (config.Provider ?? "").ToLowerInvariant();
        await using var conn = DbAdoConnectionFactory.Create(config);
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = provider switch
        {
            "sqlserver" =>
                "SELECT TABLE_NAME, NULL FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
            "firebird" =>
                "SELECT TRIM(RDB$RELATION_NAME), NULL FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL ORDER BY RDB$RELATION_NAME",
            _ => // mysql, postgres
                "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name"
        };

        var result = new List<DbTableInfo>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var name     = reader.GetString(0).Trim();
            long? count  = reader.IsDBNull(1) ? null : Convert.ToInt64(reader.GetValue(1));
            result.Add(new DbTableInfo(name, count));
        }

        return result;
    }

    private static async Task<List<DbTableInfo>> GetTablesFromDumpAsync(DbConnectionConfig config, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(config.FilePath))
            return [];

        var tables  = new List<DbTableInfo>();
        var pattern = new Regex(@"CREATE\s+TABLE\s+[`""\[]?(\w+)[`""\]]?", RegexOptions.IgnoreCase);

        await using var fs     = File.OpenRead(config.FilePath);
        using var       reader = new StreamReader(fs, Encoding.UTF8);

        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            var m = pattern.Match(line);
            if (m.Success)
                tables.Add(new DbTableInfo(m.Groups[1].Value, null));
        }

        return tables;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Colunas
    // ────────────────────────────────────────────────────────────────────────

    public async Task<List<DbColumnInfo>> GetColumnsAsync(
        DbConnectionConfig config, string tableName, CancellationToken ct)
    {
        if (string.Equals(config.Mode, "dump", StringComparison.OrdinalIgnoreCase))
            return await GetColumnsFromDumpAsync(config, tableName, ct);

        return await GetColumnsFromLiveAsync(config, tableName, ct);
    }

    private async Task<List<DbColumnInfo>> GetColumnsFromLiveAsync(
        DbConnectionConfig config, string tableName, CancellationToken ct)
    {
        var provider = (config.Provider ?? "").ToLowerInvariant();
        await using var conn = DbAdoConnectionFactory.Create(config);
        await conn.OpenAsync(ct);

        // 1. Metadados das colunas
        await using var metaCmd = conn.CreateCommand();
        metaCmd.CommandText = provider switch
        {
            "sqlserver" =>
                $"SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{tableName}' ORDER BY ORDINAL_POSITION",
            "firebird" =>
                $"SELECT TRIM(RF.RDB$FIELD_NAME), F.RDB$FIELD_TYPE, RF.RDB$NULL_FLAG " +
                $"FROM RDB$RELATION_FIELDS RF JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME " +
                $"WHERE RF.RDB$RELATION_NAME = '{tableName.ToUpperInvariant()}' ORDER BY RF.RDB$FIELD_POSITION",
            _ =>
                $"SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.columns " +
                $"WHERE table_schema = current_schema() AND table_name = '{tableName}' ORDER BY ordinal_position"
        };

        var columns = new List<(string Name, string DataType, bool IsNullable)>();
        await using var metaReader = await metaCmd.ExecuteReaderAsync(ct);
        while (await metaReader.ReadAsync(ct))
        {
            var colName    = metaReader.GetValue(0)?.ToString()?.Trim() ?? "";
            var dataType   = metaReader.GetValue(1)?.ToString() ?? "";
            var isNullable = !metaReader.IsDBNull(2) &&
                             (metaReader.GetValue(2)?.ToString() ?? "YES")
                             .Equals("YES", StringComparison.OrdinalIgnoreCase);
            columns.Add((colName, dataType, isNullable));
        }

        // 2. Amostras (top 20)
        var samples = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        if (columns.Count > 0)
        {
            await using var sampleCmd = conn.CreateCommand();
            sampleCmd.CommandText = provider switch
            {
                "sqlserver" => $"SELECT TOP 20 * FROM [{tableName}]",
                "firebird"  => $"SELECT FIRST 20 * FROM \"{tableName}\"",
                _           => $"SELECT * FROM `{tableName}` LIMIT 20"
            };

            await using var sampleReader = await sampleCmd.ExecuteReaderAsync(ct);
            while (await sampleReader.ReadAsync(ct))
            {
                for (int i = 0; i < sampleReader.FieldCount; i++)
                {
                    var colName = sampleReader.GetName(i);
                    if (!samples.TryGetValue(colName, out var list))
                        samples[colName] = list = new List<string>();

                    if (list.Count < 5 && !sampleReader.IsDBNull(i))
                    {
                        var val = sampleReader.GetValue(i)?.ToString() ?? "";
                        if (!list.Contains(val) && !string.IsNullOrWhiteSpace(val))
                            list.Add(val);
                    }
                }
            }
        }

        return columns.Select(c => new DbColumnInfo(
            c.Name,
            c.DataType,
            c.IsNullable,
            samples.TryGetValue(c.Name, out var s) ? s : []
        )).ToList();
    }

    private static async Task<List<DbColumnInfo>> GetColumnsFromDumpAsync(
        DbConnectionConfig config, string tableName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(config.FilePath))
            return [];

        var createRegex = new Regex(
            $@"CREATE\s+TABLE\s+[`""\[]?{Regex.Escape(tableName)}[`""\]]?\s*\(",
            RegexOptions.IgnoreCase);

        var colPattern = new Regex(
            @"^[`""\[]?(\w+)[`""\]]?\s+(\w+)",
            RegexOptions.IgnoreCase);

        var columns   = new List<DbColumnInfo>();
        bool inCreate = false;

        await using var fs     = File.OpenRead(config.FilePath);
        using var       reader = new StreamReader(fs, Encoding.UTF8);

        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            if (!inCreate && createRegex.IsMatch(line))
            {
                inCreate = true;
                continue;
            }

            if (inCreate)
            {
                if (line.TrimStart().StartsWith(')'))
                    break;

                var m = colPattern.Match(line.Trim());
                if (!m.Success) continue;

                var colName  = m.Groups[1].Value;
                var dataType = m.Groups[2].Value;

                var skip = new[] { "PRIMARY", "KEY", "UNIQUE", "INDEX", "CONSTRAINT" };
                if (skip.Any(s => s.Equals(colName, StringComparison.OrdinalIgnoreCase)))
                    continue;

                columns.Add(new DbColumnInfo(colName, dataType, true, []));
            }
        }

        return columns;
    }
}
