namespace Petshop.Api.Services.Sync;

/// <summary>
/// Configuração de conexão para conectores de banco de dados relacional.
/// Serializada como JSON em ExternalSource.ConnectionConfigEncrypted.
/// </summary>
public class DbConnectionConfig
{
    /// <summary>"live" (conexão direta) ou "dump" (arquivo .sql)</summary>
    public string Mode { get; set; } = "live";

    /// <summary>"MySql" | "Postgres" | "SqlServer" | "Firebird"</summary>
    public string? Provider { get; set; }

    /// <summary>String de conexão completa (modo live)</summary>
    public string? ConnectionString { get; set; }

    /// <summary>Caminho do arquivo .sql no servidor (modo dump)</summary>
    public string? FilePath { get; set; }

    /// <summary>Tabela de origem dos produtos</summary>
    public string TableName { get; set; } = "produtos";

    /// <summary>Coluna de timestamp para delta sync (opcional)</summary>
    public string? UpdatedAtColumn { get; set; }

    /// <summary>Mapeamento: chave = coluna externa, valor = campo do DTO</summary>
    public Dictionary<string, string> ColumnMapping { get; set; } = new();

    /// <summary>"cents" | "reais" | "auto"</summary>
    public string PriceUnit { get; set; } = "auto";
}
