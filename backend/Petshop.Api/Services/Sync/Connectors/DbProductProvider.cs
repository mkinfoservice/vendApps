using System.Data;
using System.Data.Common;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Petshop.Api.Services.Sync.Connectors;

/// <summary>
/// Conector de banco de dados relacional (MySQL, PostgreSQL, SQL Server, Firebird).
/// Suporta conexão live (ADO.NET) e dump de arquivo .sql.
/// ConnectionConfigEncrypted: serialização de DbConnectionConfig.
/// </summary>
public class DbProductProvider : IProductProvider
{
    private readonly DbConnectionConfig _config;
    private readonly bool _isDump;

    public string ProviderName => $"DB ({_config.Provider ?? "??"} / {_config.Mode})";

    public DbProductProvider(string connectionConfigJson)
    {
        _config = JsonSerializer.Deserialize<DbConnectionConfig>(
            connectionConfigJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new DbConnectionConfig();
        _isDump = string.Equals(_config.Mode, "dump", StringComparison.OrdinalIgnoreCase);
    }

    public Task<ProviderCapabilities> GetCapabilitiesAsync(CancellationToken ct)
    {
        var supportsDelta = !_isDump && !string.IsNullOrWhiteSpace(_config.UpdatedAtColumn);
        var supportsImages = _config.ColumnMapping.Values
            .Any(v => string.Equals(v, "ImageUrl", StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(new ProviderCapabilities
        {
            SupportsDelta = supportsDelta,
            SupportsHashCheck = false,
            SupportsImages = supportsImages
        });
    }

    public async Task<IReadOnlyList<ExternalProductDto>> FetchProductsAsync(
        ExternalProductQuery query, CancellationToken ct)
    {
        if (_isDump)
            return await FetchFromDumpAsync(query, ct);
        return await FetchFromLiveDbAsync(query, ct);
    }

    public async Task<(bool Success, string Message, int SampleCount)> TestConnectionAsync(
        CancellationToken ct)
    {
        try
        {
            var sample = await FetchProductsAsync(
                new ExternalProductQuery { Page = 1, BatchSize = 5, SyncType = Entities.Sync.SyncType.Full },
                ct);
            return (true, $"Conexão OK. {sample.Count} produto(s) de amostra lido(s).", sample.Count);
        }
        catch (Exception ex)
        {
            return (false, ClassifyConnectionError(ex), 0);
        }
    }

    private string ClassifyConnectionError(Exception ex)
    {
        var msg = ex.Message + " " + (ex.InnerException?.Message ?? "");
        var lower = msg.ToLowerInvariant();

        if (lower.Contains("access denied") || lower.Contains("authentication failed") ||
            lower.Contains("login failed") || lower.Contains("password") ||
            lower.Contains("invalid credentials"))
            return "Usuário ou senha inválidos. Verifique as credenciais na connection string.";

        if (lower.Contains("unable to connect") || lower.Contains("connection refused") ||
            lower.Contains("no route to host") || lower.Contains("timed out") ||
            lower.Contains("timeout") || lower.Contains("socket") ||
            lower.Contains("network") || lower.Contains("host") && lower.Contains("port"))
            return "Não foi possível conectar: verifique host, porta e se o firewall permite a conexão.";

        if (lower.Contains("unknown database") ||
            (lower.Contains("database") && lower.Contains("does not exist")) ||
            lower.Contains("catalog"))
            return "Banco de dados não encontrado. Verifique o nome do banco na connection string.";

        if (lower.Contains("table") &&
            (lower.Contains("not found") || lower.Contains("doesn't exist") || lower.Contains("does not exist")))
            return $"Tabela '{_config.TableName}' não encontrada no banco de dados.";

        return ex.Message;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Live DB
    // ────────────────────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<ExternalProductDto>> FetchFromLiveDbAsync(
        ExternalProductQuery query, CancellationToken ct)
    {
        var offset = (query.Page - 1) * query.BatchSize;
        var limit  = query.BatchSize;
        var provider = (_config.Provider ?? "").ToLowerInvariant();
        var table    = _config.TableName;

        await using var conn = DbAdoConnectionFactory.Create(_config);
        await conn.OpenAsync(ct);

        await using var cmd = conn.CreateCommand();
        var sb = new StringBuilder($"SELECT * FROM {QuoteIdentifier(table, provider)}");

        if (query.UpdatedSince.HasValue && !string.IsNullOrWhiteSpace(_config.UpdatedAtColumn))
        {
            sb.Append($" WHERE {QuoteIdentifier(_config.UpdatedAtColumn, provider)} > @updatedSince");
            var p = cmd.CreateParameter();
            p.ParameterName = "@updatedSince";
            p.Value = query.UpdatedSince.Value;
            cmd.Parameters.Add(p);
        }

        // Paginação dependente do provider
        switch (provider)
        {
            case "sqlserver":
                sb.Append($" ORDER BY (SELECT NULL) OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY");
                break;
            case "firebird":
                // Firebird não suporta parâmetros para FIRST/SKIP
                sb.Insert(7, $" FIRST {limit} SKIP {offset}");
                break;
            default: // mysql, mariadb, postgres
                sb.Append($" LIMIT {limit} OFFSET {offset}");
                break;
        }

        cmd.CommandText = sb.ToString();

        var results = new List<ExternalProductDto>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var dto = MapRow(reader);
            if (dto != null) results.Add(dto);
        }

        return results;
    }

    private static string QuoteIdentifier(string name, string provider) =>
        provider switch
        {
            "sqlserver"          => $"[{name}]",
            "mysql" or "mariadb" => $"`{name}`",
            _                    => $"\"{name}\"",   // postgres, firebird
        };

    private ExternalProductDto? MapRow(IDataRecord reader)
    {
        // Inverte o mapeamento: valor (campo DTO) → chave (coluna externa)
        var inv = _config.ColumnMapping.ToDictionary(
            kv => kv.Value,
            kv => kv.Key,
            StringComparer.OrdinalIgnoreCase);

        string? Get(string dtoField)
        {
            if (!inv.TryGetValue(dtoField, out var col)) return null;
            try
            {
                var idx = reader.GetOrdinal(col);
                return reader.IsDBNull(idx) ? null : reader.GetValue(idx)?.ToString();
            }
            catch { return null; }
        }

        var name = Get("Name");
        if (string.IsNullOrWhiteSpace(name)) return null;

        var dto = new ExternalProductDto
        {
            ExternalId    = Get("ExternalId"),
            InternalCode  = Get("InternalCode"),
            Barcode       = Get("Barcode"),
            Name          = name!,
            Description   = Get("Description"),
            CategoryName  = Get("CategoryName"),
            BrandName     = Get("BrandName"),
            Unit          = Get("Unit") ?? "UN",
            IsActive      = ParseBool(Get("IsActive")),
            Ncm           = Get("Ncm"),
            ImageUrl      = Get("ImageUrl"),
            StockQty      = ParseDecimal(Get("StockQty")),
        };

        dto.PriceCents = ConvertPrice(ParseDecimal(Get("PriceCents")));
        dto.CostCents  = ConvertPrice(ParseDecimal(Get("CostCents")));

        var updatedRaw = Get("UpdatedAt");
        if (updatedRaw != null && DateTime.TryParse(updatedRaw, out var updatedAt))
            dto.UpdatedAtUtc = updatedAt.ToUniversalTime();

        return dto;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SQL Dump
    // ────────────────────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<ExternalProductDto>> FetchFromDumpAsync(
        ExternalProductQuery query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_config.FilePath))
            throw new InvalidOperationException("FilePath não configurado para modo dump.");

        var offset = (query.Page - 1) * query.BatchSize;
        var table  = _config.TableName;

        var columnNames = new List<string>();
        var rows        = new List<List<string>>();
        int rowCount    = 0;

        var createTableRegex = new Regex(
            $@"CREATE\s+TABLE\s+[`""\[]?{Regex.Escape(table)}[`""\]]?\s*\(",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        var insertRegex = new Regex(
            $@"INSERT\s+INTO\s+[`""\[]?{Regex.Escape(table)}[`""\]]?.*?VALUES\s*\((.+)\)\s*;?$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Singleline);

        bool inCreate = false;

        await using var fs     = File.OpenRead(_config.FilePath);
        using var       reader = new StreamReader(fs, Encoding.UTF8);

        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            if (ct.IsCancellationRequested) break;

            if (!inCreate && createTableRegex.IsMatch(line))
            {
                inCreate = true;
                columnNames.Clear();
                continue;
            }

            if (inCreate)
            {
                // Fim do CREATE TABLE
                if (line.TrimStart().StartsWith(')'))
                {
                    inCreate = false;
                    continue;
                }

                // Extrai nome da coluna (primeira palavra entre backticks ou identificador)
                var colMatch = Regex.Match(line.Trim(), @"^[`""\[]?(\w+)[`""\]]?");
                if (colMatch.Success)
                {
                    var colName = colMatch.Groups[1].Value;
                    if (!colName.Equals("PRIMARY", StringComparison.OrdinalIgnoreCase) &&
                        !colName.Equals("KEY", StringComparison.OrdinalIgnoreCase) &&
                        !colName.Equals("UNIQUE", StringComparison.OrdinalIgnoreCase) &&
                        !colName.Equals("INDEX", StringComparison.OrdinalIgnoreCase) &&
                        !colName.Equals("CONSTRAINT", StringComparison.OrdinalIgnoreCase))
                    {
                        columnNames.Add(colName);
                    }
                }
                continue;
            }

            // Detectar INSERT INTO
            var insertMatch = insertRegex.Match(line);
            if (!insertMatch.Success) continue;

            rowCount++;
            if (rowCount <= offset) continue;
            if (rows.Count >= query.BatchSize) break;

            var values = ParseSqlValues(insertMatch.Groups[1].Value);
            rows.Add(values);
        }

        var inv = _config.ColumnMapping.ToDictionary(
            kv => kv.Value,
            kv => kv.Key,
            StringComparer.OrdinalIgnoreCase);

        // Índice: nome da coluna → posição
        var colIndex = columnNames
            .Select((c, i) => (c, i))
            .ToDictionary(x => x.c, x => x.i, StringComparer.OrdinalIgnoreCase);

        var results = new List<ExternalProductDto>();

        foreach (var row in rows)
        {
            string? Get(string dtoField)
            {
                if (!inv.TryGetValue(dtoField, out var col)) return null;
                if (!colIndex.TryGetValue(col, out var idx)) return null;
                return idx < row.Count ? row[idx] : null;
            }

            var name = Get("Name");
            if (string.IsNullOrWhiteSpace(name)) continue;

            var dto = new ExternalProductDto
            {
                ExternalId   = Get("ExternalId"),
                InternalCode = Get("InternalCode"),
                Barcode      = Get("Barcode"),
                Name         = name!,
                Description  = Get("Description"),
                CategoryName = Get("CategoryName"),
                BrandName    = Get("BrandName"),
                Unit         = Get("Unit") ?? "UN",
                IsActive     = ParseBool(Get("IsActive")),
                Ncm          = Get("Ncm"),
                ImageUrl     = Get("ImageUrl"),
                StockQty     = ParseDecimal(Get("StockQty")),
            };

            dto.PriceCents = ConvertPrice(ParseDecimal(Get("PriceCents")));
            dto.CostCents  = ConvertPrice(ParseDecimal(Get("CostCents")));

            var updatedRaw = Get("UpdatedAt");
            if (updatedRaw != null && DateTime.TryParse(updatedRaw, out var updatedAt))
                dto.UpdatedAtUtc = updatedAt.ToUniversalTime();

            results.Add(dto);
        }

        return results;
    }

    /// <summary>
    /// Parser simples de VALUES do SQL: trata strings com aspas simples, escapes e NULL.
    /// </summary>
    private static List<string> ParseSqlValues(string valuesStr)
    {
        var result  = new List<string>();
        var current = new StringBuilder();
        bool inStr  = false;
        int  i      = 0;

        while (i < valuesStr.Length)
        {
            var c = valuesStr[i];

            if (inStr)
            {
                if (c == '\'' && i + 1 < valuesStr.Length && valuesStr[i + 1] == '\'')
                {
                    current.Append('\'');
                    i += 2;
                }
                else if (c == '\\' && i + 1 < valuesStr.Length)
                {
                    current.Append(valuesStr[i + 1]);
                    i += 2;
                }
                else if (c == '\'')
                {
                    inStr = false;
                    i++;
                }
                else
                {
                    current.Append(c);
                    i++;
                }
            }
            else
            {
                if (c == '\'')
                {
                    inStr = true;
                    i++;
                }
                else if (c == ',')
                {
                    result.Add(current.ToString().Trim());
                    current.Clear();
                    i++;
                }
                else
                {
                    current.Append(c);
                    i++;
                }
            }
        }

        result.Add(current.ToString().Trim());

        // Normalizar NULL → string vazia
        return result.Select(v =>
            v.Equals("NULL", StringComparison.OrdinalIgnoreCase) ? "" : v
        ).ToList();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────

    private int ConvertPrice(decimal raw) =>
        _config.PriceUnit switch
        {
            "cents" => (int)raw,
            "reais" => (int)(raw * 100),
            _       => raw > 1000 ? (int)raw : (int)(raw * 100)  // "auto"
        };

    private static decimal ParseDecimal(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return 0;
        var normalized = s.Replace(',', '.');
        return decimal.TryParse(normalized,
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out var v) ? v : 0;
    }

    private static bool ParseBool(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return true;
        // Handles: 1/true/yes, S/SIM (Portuguese), T (common ERP flag), and variants
        return s.ToUpperInvariant() is "1" or "TRUE" or "YES" or "S" or "SIM" or "T";
    }
}
