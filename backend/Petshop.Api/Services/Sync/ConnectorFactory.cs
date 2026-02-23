using Petshop.Api.Entities.Sync;
using Petshop.Api.Services.Sync.Connectors;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Instancia o conector correto com base no ConnectorType da ExternalSource.
/// </summary>
public class ConnectorFactory
{
    private readonly IHttpClientFactory _httpClientFactory;

    public ConnectorFactory(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public IProductProvider Create(ExternalSource source)
    {
        var config = source.ConnectionConfigEncrypted ?? "{}";

        return source.ConnectorType switch
        {
            ConnectorType.Csv    => new CsvProductProvider(config),
            ConnectorType.RestErp => new RestApiProductProvider(config, _httpClientFactory),
            ConnectorType.Json   => new RestApiProductProvider(config, _httpClientFactory),
            ConnectorType.MySql
                or ConnectorType.Postgres
                or ConnectorType.SqlServer
                or ConnectorType.Oracle
                or ConnectorType.Firebird => new DbProductProvider(config),
            _ => throw new NotSupportedException($"Conector não suportado: {source.ConnectorType}")
        };
    }
}
