using System.Text.Json;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Determina, baseado nas políticas da empresa (Company.SettingsJson),
/// quais campos podem ser sobrescritos durante um sync.
/// Política padrão: atualiza tudo.
/// </summary>
public class SyncMergePolicyService
{
    private static readonly MergePolicy DefaultPolicy = new()
    {
        UpdatePrice = true,
        UpdateCost = true,
        UpdateStock = true,
        UpdateDescription = true,
        UpdateName = true,
        UpdateCategory = true,
        UpdateBrand = true,
        ConflictResolution = ConflictResolution.PreferExternal
    };

    public MergePolicy GetPolicy(Company company)
    {
        if (string.IsNullOrWhiteSpace(company.SettingsJson))
            return DefaultPolicy;

        try
        {
            var policy = JsonSerializer.Deserialize<MergePolicy>(company.SettingsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return policy ?? DefaultPolicy;
        }
        catch
        {
            return DefaultPolicy;
        }
    }

    public bool ShouldUpdateField(string fieldName, MergePolicy policy) => fieldName switch
    {
        "PriceCents" => policy.UpdatePrice,
        "CostCents"  => policy.UpdateCost,
        "StockQty"   => policy.UpdateStock,
        "Description" => policy.UpdateDescription,
        "Name"       => policy.UpdateName,
        "CategoryId" => policy.UpdateCategory,
        "BrandId"    => policy.UpdateBrand,
        _ => true
    };
}

public class MergePolicy
{
    public bool UpdatePrice { get; set; } = true;
    public bool UpdateCost { get; set; } = true;
    public bool UpdateStock { get; set; } = true;
    public bool UpdateDescription { get; set; } = true;
    public bool UpdateName { get; set; } = true;
    public bool UpdateCategory { get; set; } = true;
    public bool UpdateBrand { get; set; } = true;
    public ConflictResolution ConflictResolution { get; set; } = ConflictResolution.PreferExternal;
}

public enum ConflictResolution { PreferExternal, PreferManual, Flag }
