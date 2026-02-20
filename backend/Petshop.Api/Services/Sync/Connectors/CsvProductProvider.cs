using System.Globalization;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;

namespace Petshop.Api.Services.Sync.Connectors;

/// <summary>
/// Conector CSV. ConnectionConfigEncrypted deve conter:
/// { "FilePath": "/caminho/arquivo.csv", "Delimiter": "," }
/// Colunas esperadas no CSV (case-insensitive):
/// ExternalId, InternalCode, Barcode, Name, Description, CategoryName, BrandName,
/// Unit, CostCents, PriceCents, StockQty, IsActive, Ncm, UpdatedAt
/// </summary>
public class CsvProductProvider : IProductProvider
{
    private readonly string _filePath;
    private readonly string _delimiter;

    public string ProviderName => "CSV";

    public CsvProductProvider(string connectionConfigJson)
    {
        var config = JsonSerializer.Deserialize<CsvConfig>(connectionConfigJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Configuração CSV inválida.");

        _filePath = config.FilePath ?? throw new InvalidOperationException("FilePath é obrigatório.");
        _delimiter = config.Delimiter ?? ",";
    }

    public Task<ProviderCapabilities> GetCapabilitiesAsync(CancellationToken ct) =>
        Task.FromResult(new ProviderCapabilities
        {
            SupportsDelta = false,
            SupportsHashCheck = false,
            SupportsImages = false
        });

    public async Task<IReadOnlyList<ExternalProductDto>> FetchProductsAsync(ExternalProductQuery query, CancellationToken ct)
    {
        if (!File.Exists(_filePath))
            throw new FileNotFoundException($"Arquivo CSV não encontrado: {_filePath}");

        var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = _delimiter,
            HeaderValidated = null,
            MissingFieldFound = null,
            PrepareHeaderForMatch = args => args.Header.Trim().ToLowerInvariant()
        };

        await using var stream = File.OpenRead(_filePath);
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, csvConfig);

        var results = new List<ExternalProductDto>();
        var skip = (query.Page - 1) * query.BatchSize;
        var count = 0;
        var index = 0;

        await csv.ReadAsync();
        csv.ReadHeader();

        while (await csv.ReadAsync())
        {
            if (ct.IsCancellationRequested) break;

            if (index++ < skip) continue;
            if (count >= query.BatchSize) break;

            var record = new ExternalProductDto
            {
                ExternalId    = csv.TryGetField("externalid", out string? extId) ? extId : null,
                InternalCode  = csv.TryGetField("internalcode", out string? ic) ? ic : null,
                Barcode       = csv.TryGetField("barcode", out string? bc) ? bc : null,
                Name          = csv.GetField<string>("name") ?? string.Empty,
                Description   = csv.TryGetField("description", out string? desc) ? desc : null,
                CategoryName  = csv.TryGetField("categoryname", out string? cat) ? cat : null,
                BrandName     = csv.TryGetField("brandname", out string? brand) ? brand : null,
                Unit          = csv.TryGetField("unit", out string? unit) && !string.IsNullOrEmpty(unit) ? unit : "UN",
                IsActive      = !csv.TryGetField("isactive", out string? active) || active?.ToLower() is "true" or "1" or "sim" or "s",
                Ncm           = csv.TryGetField("ncm", out string? ncm) ? ncm : null,
            };

            if (csv.TryGetField("costcents", out int cost)) record.CostCents = cost;
            if (csv.TryGetField("pricecents", out int price)) record.PriceCents = price;
            if (csv.TryGetField("stockqty", out decimal stock)) record.StockQty = stock;
            if (csv.TryGetField("updatedat", out DateTime updatedAt)) record.UpdatedAtUtc = DateTime.SpecifyKind(updatedAt, DateTimeKind.Utc);

            // Fallback: ExternalId = InternalCode ou Barcode
            record.ExternalId ??= record.InternalCode ?? record.Barcode;

            if (!string.IsNullOrWhiteSpace(record.Name))
            {
                results.Add(record);
                count++;
            }
        }

        return results;
    }

    public async Task<(bool Success, string Message, int SampleCount)> TestConnectionAsync(CancellationToken ct)
    {
        try
        {
            var sample = await FetchProductsAsync(new ExternalProductQuery { Page = 1, BatchSize = 5 }, ct);
            return (true, $"Arquivo CSV lido com sucesso. {sample.Count} registros na amostra.", sample.Count);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, 0);
        }
    }

    private class CsvConfig
    {
        public string? FilePath { get; set; }
        public string? Delimiter { get; set; }
    }
}
