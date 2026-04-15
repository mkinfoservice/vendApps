using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Services.Tenancy;

public static class AppFeatureKeys
{
    public const string Agenda = "agenda";
    public const string Commissions = "commissions";
    public const string Tips = "tips";
    public const string DavMenu = "dav_menu";
    public const string FinancialMenu = "financial_menu";
    public const string LoyaltyProgram = "loyalty_program";
    public const string AccountingEmailDispatch = "accounting_email_dispatch";
    /// <summary>Exibe módulos de entrega própria (Rotas, Entregadores). false = entrega somente via marketplace.</summary>
    public const string OwnDelivery = "own_delivery";
    public const string ModernCatalogExperience = "modern_catalog_experience";
}

public class PlanFeatureService
{
    private readonly AppDbContext _db;

    public PlanFeatureService(AppDbContext db)
    {
        _db = db;
    }

    public static readonly string[] SupportedFeatures =
    [
        AppFeatureKeys.Agenda,
        AppFeatureKeys.Commissions,
        AppFeatureKeys.Tips,
        AppFeatureKeys.DavMenu,
        AppFeatureKeys.FinancialMenu,
        AppFeatureKeys.LoyaltyProgram,
        AppFeatureKeys.AccountingEmailDispatch,
        AppFeatureKeys.OwnDelivery,
        AppFeatureKeys.ModernCatalogExperience
    ];

    public async Task<Dictionary<string, bool>> ResolveFeaturesAsync(Company company, CancellationToken ct = default)
    {
        var features = BuildPlanDefaults(company.Plan);

        var overrides = await _db.CompanyFeatureOverrides
            .AsNoTracking()
            .Where(f => f.CompanyId == company.Id)
            .ToListAsync(ct);

        foreach (var ov in overrides)
        {
            features[ov.FeatureKey] = ov.IsEnabled;
        }

        return features;
    }

    public static Dictionary<string, bool> BuildPlanDefaults(string? plan)
    {
        return new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
        {
            [AppFeatureKeys.Agenda] = IsPlanAtLeast(plan, "pro"),
            [AppFeatureKeys.Commissions] = IsPlanAtLeast(plan, "trial"),
            [AppFeatureKeys.Tips] = IsPlanAtLeast(plan, "trial"),
            [AppFeatureKeys.DavMenu] = true,
            [AppFeatureKeys.FinancialMenu] = IsPlanAtLeast(plan, "trial"),
            [AppFeatureKeys.LoyaltyProgram] = IsPlanAtLeast(plan, "trial"),
            [AppFeatureKeys.AccountingEmailDispatch] = IsPlanAtLeast(plan, "pro"),
            [AppFeatureKeys.OwnDelivery] = true,
            [AppFeatureKeys.ModernCatalogExperience] = false,
        };
    }

    public static bool IsFeatureKeySupported(string key) =>
        SupportedFeatures.Contains((key ?? "").Trim(), StringComparer.OrdinalIgnoreCase);

    public static bool IsPlanAtLeast(string? plan, string minPlan)
    {
        return PlanRank(plan) >= PlanRank(minPlan);
    }

    private static int PlanRank(string? plan)
    {
        return (plan ?? "").Trim().ToLowerInvariant() switch
        {
            "trial" => 1,
            "starter" => 2,
            "pro" => 3,
            "enterprise" => 4,
            _ => 1
        };
    }
}
