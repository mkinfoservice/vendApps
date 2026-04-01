using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Marketplace;

namespace Petshop.Api.Services.Marketplace.IFood;

/// <summary>
/// Sincroniza o cardápio interno (produtos ativos) com o catálogo iFood.
/// Suporta:
///  - Atualização de preço e disponibilidade de itens existentes
///  - Relatório de itens não encontrados no iFood (precisam ser criados manualmente no portal)
///
/// NOTA: A criação de novos itens no catálogo iFood requer aprovação manual no portal do parceiro.
/// Esta implementação foca em manter preços/disponibilidade sincronizados para itens já cadastrados.
/// </summary>
public class iFoodCatalogSyncService
{
    private readonly AppDbContext _db;
    private readonly iFoodAuthService _auth;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<iFoodCatalogSyncService> _logger;

    private const string BaseUrl = "https://merchant-api.ifood.com.br";

    public iFoodCatalogSyncService(
        AppDbContext db,
        iFoodAuthService auth,
        IHttpClientFactory http,
        ILogger<iFoodCatalogSyncService> logger)
    {
        _db    = db;
        _auth  = auth;
        _http  = http;
        _logger = logger;
    }

    /// <summary>
    /// Atualiza preços e disponibilidade de todos os produtos ativos no iFood.
    /// Usa o externalCode (InternalCode ou Barcode do produto) como chave de matching.
    /// </summary>
    public async Task<CatalogSyncResult> SyncPricesAsync(
        MarketplaceIntegration integration,
        CancellationToken ct = default)
    {
        var result = new CatalogSyncResult();

        // 1. Busca produtos ativos da empresa
        var products = await _db.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == integration.CompanyId && p.IsActive && !p.IsSupply)
            .ToListAsync(ct);

        if (!products.Any())
        {
            _logger.LogInformation("[iFood] Nenhum produto ativo para sincronizar. CompanyId={Id}", integration.CompanyId);
            return result;
        }

        // 2. Busca catálogo atual do iFood
        var catalog = await FetchCatalogAsync(integration, ct);
        if (catalog is null)
        {
            result.ErrorMessage = "Falha ao buscar catálogo do iFood.";
            return result;
        }

        // Indexa itens iFood pelo externalCode (campo que mapeamos para InternalCode/Barcode)
        var iFoodItemsById = catalog
            .ToDictionary(i => i.ExternalCode ?? i.Id, StringComparer.OrdinalIgnoreCase);

        // 3. Gera batch de atualizações
        var updates = new List<iFoodPriceUpdate>();

        foreach (var product in products)
        {
            var key = product.InternalCode ?? product.Barcode;
            if (string.IsNullOrEmpty(key) || !iFoodItemsById.TryGetValue(key, out var iFoodItem))
            {
                result.NotFound.Add(product.Name);
                continue;
            }

            var newPriceCents = product.PriceCents;
            var currentPriceCents = (int)Math.Round(iFoodItem.Price * 100);

            if (currentPriceCents == newPriceCents && iFoodItem.Available == product.IsActive)
            {
                result.Skipped++;
                continue;
            }

            updates.Add(new iFoodPriceUpdate
            {
                ItemId    = iFoodItem.Id,
                Price     = newPriceCents / 100m,
                Available = product.IsActive,
            });
        }

        // 4. Envia batch ao iFood (max 100 por request)
        foreach (var batch in updates.Chunk(100))
        {
            var success = await SendPriceUpdateBatchAsync(integration, batch, ct);
            if (success)
                result.Updated += batch.Length;
            else
                result.Failed  += batch.Length;
        }

        // 5. Atualiza timestamp
        integration.LastCatalogSyncAtUtc = DateTime.UtcNow;
        integration.LastErrorMessage = result.Failed > 0 ? $"{result.Failed} itens falharam na sync." : null;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "[iFood] Sync cardápio concluída. Updated={U} Skipped={S} NotFound={N} Failed={F}",
            result.Updated, result.Skipped, result.NotFound.Count, result.Failed);

        return result;
    }

    // ── API calls ────────────────────────────────────────────────────────────

    private async Task<List<iFoodCatalogItem>?> FetchCatalogAsync(
        MarketplaceIntegration integration,
        CancellationToken ct)
    {
        try
        {
            var token = await _auth.GetTokenAsync(integration, ct);
            using var client = CreateClient(token);

            var url = $"{BaseUrl}/catalog/v1.0/merchants/{integration.MerchantId}/items";
            var response = await client.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[iFood] Falha ao buscar catálogo. Status={S}", response.StatusCode);
                return null;
            }

            var items = await response.Content
                .ReadFromJsonAsync<List<iFoodCatalogItem>>(cancellationToken: ct);
            return items ?? new List<iFoodCatalogItem>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[iFood] Erro ao buscar catálogo.");
            return null;
        }
    }

    private async Task<bool> SendPriceUpdateBatchAsync(
        MarketplaceIntegration integration,
        iFoodPriceUpdate[] batch,
        CancellationToken ct)
    {
        try
        {
            var token = await _auth.GetTokenAsync(integration, ct);
            using var client = CreateClient(token);

            var url = $"{BaseUrl}/catalog/v1.0/merchants/{integration.MerchantId}/items/batch-update";
            var json = JsonSerializer.Serialize(batch);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PatchAsync(url, content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("[iFood] Falha no batch-update. Status={S} Body={B}",
                    response.StatusCode, body);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[iFood] Erro no batch-update de preços.");
            return false;
        }
    }

    private HttpClient CreateClient(string token)
    {
        var client = _http.CreateClient("ifood");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // ── DTOs internos ────────────────────────────────────────────────────────

    private sealed class iFoodCatalogItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("externalCode")]
        public string? ExternalCode { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("available")]
        public bool Available { get; set; }
    }

    private sealed class iFoodPriceUpdate
    {
        [JsonPropertyName("itemId")]
        public string ItemId { get; set; } = "";

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("available")]
        public bool Available { get; set; }
    }
}

public class CatalogSyncResult
{
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public int Failed  { get; set; }
    public List<string> NotFound { get; set; } = new();
    public string? ErrorMessage { get; set; }
}
