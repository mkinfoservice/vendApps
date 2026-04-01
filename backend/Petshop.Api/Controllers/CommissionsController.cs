using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Commissions;
using Petshop.Api.Entities.Master;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Services.Tenancy;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/commissions")]
[Authorize(Roles = "admin,gerente")]
public class CommissionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PlanFeatureService _features;

    public CommissionsController(AppDbContext db, PlanFeatureService features)
    {
        _db = db;
        _features = features;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);
    private string UserName => User.FindFirstValue(ClaimTypes.Name) ?? "Operador";

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var cfg = await GetOrCreateConfigAsync(ct);
        return Ok(cfg);
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpsertConfig([FromBody] UpsertCommissionConfigRequest req, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var cfg = await GetOrCreateConfigAsync(ct);

        if (req.IsEnabled.HasValue) cfg.IsEnabled = req.IsEnabled.Value;
        if (req.IsTipEnabled.HasValue) cfg.IsTipEnabled = req.IsTipEnabled.Value;
        if (req.DefaultCommissionPercent.HasValue) cfg.DefaultCommissionPercent = Math.Max(0m, req.DefaultCommissionPercent.Value);
        if (!string.IsNullOrWhiteSpace(req.TipDistributionMode))
        {
            var mode = req.TipDistributionMode.Trim().ToLowerInvariant();
            var valid = mode is "equal" or "proportional_sales" or "proportional_commission";
            if (!valid) return BadRequest(new { error = "TipDistributionMode inválido." });
            cfg.TipDistributionMode = mode;
        }

        cfg.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(cfg);
    }

    [HttpGet("employees")]
    public async Task<IActionResult> GetEmployees(CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var cfg = await GetOrCreateConfigAsync(ct);

        var team = await _db.AdminUsers
            .AsNoTracking()
            .Where(u => u.CompanyId == CompanyId && u.Role != "admin")
            .OrderBy(u => u.Username)
            .ToListAsync(ct);

        var rates = await _db.EmployeeCommissionRates
            .AsNoTracking()
            .Where(r => r.CompanyId == CompanyId && r.IsActive)
            .ToListAsync(ct);

        var data = team.Select(u =>
        {
            var rate = rates.FirstOrDefault(r => r.AdminUserId == u.Id);
            return new
            {
                userId = u.Id,
                username = u.Username,
                role = u.Role,
                isActive = u.IsActive,
                commissionPercent = rate?.CommissionPercent ?? cfg.DefaultCommissionPercent,
                hasCustomRate = rate is not null
            };
        });

        return Ok(data);
    }

    [HttpPut("employees/{userId:guid}/rate")]
    public async Task<IActionResult> SetEmployeeRate(Guid userId, [FromBody] SetEmployeeRateRequest req, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Id == userId && u.CompanyId == CompanyId && u.Role != "admin", ct);

        if (user is null) return NotFound(new { error = "Colaborador não encontrado." });
        if (req.CommissionPercent < 0m) return BadRequest(new { error = "Percentual inválido." });

        var rate = await _db.EmployeeCommissionRates
            .FirstOrDefaultAsync(r => r.CompanyId == CompanyId && r.AdminUserId == userId, ct);

        if (rate is null)
        {
            rate = new EmployeeCommissionRate
            {
                CompanyId = CompanyId,
                AdminUserId = userId,
                CommissionPercent = req.CommissionPercent,
                IsActive = true,
                UpdatedAtUtc = DateTime.UtcNow
            };
            _db.EmployeeCommissionRates.Add(rate);
        }
        else
        {
            rate.CommissionPercent = req.CommissionPercent;
            rate.IsActive = true;
            rate.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { userId, rate.CommissionPercent, rate.IsActive });
    }

    [HttpDelete("employees/{userId:guid}/rate")]
    public async Task<IActionResult> ResetEmployeeRate(Guid userId, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var rate = await _db.EmployeeCommissionRates
            .FirstOrDefaultAsync(r => r.CompanyId == CompanyId && r.AdminUserId == userId, ct);

        if (rate is null) return NoContent();

        rate.IsActive = false;
        rate.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("tips")]
    public async Task<IActionResult> ListTips([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var (startUtc, endExclusiveUtc) = ResolveRange(from, to);

        var tips = await _db.TipPoolEntries
            .AsNoTracking()
            .Where(t => t.CompanyId == CompanyId && t.ReferenceDateUtc >= startUtc && t.ReferenceDateUtc < endExclusiveUtc)
            .OrderByDescending(t => t.ReferenceDateUtc)
            .ThenByDescending(t => t.CreatedAtUtc)
            .ToListAsync(ct);

        return Ok(tips);
    }

    [HttpPost("tips")]
    public async Task<IActionResult> AddTip([FromBody] AddTipEntryRequest req, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        if (req.AmountCents <= 0) return BadRequest(new { error = "Valor da gorjeta deve ser positivo." });

        var entry = new TipPoolEntry
        {
            CompanyId = CompanyId,
            ReferenceDateUtc = req.ReferenceDateUtc?.Date ?? DateTime.UtcNow.Date,
            AmountCents = req.AmountCents,
            Description = req.Description?.Trim() ?? "",
            CreatedBy = UserName,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.TipPoolEntries.Add(entry);
        await _db.SaveChangesAsync(ct);
        return Ok(entry);
    }

    [HttpDelete("tips/{id:guid}")]
    public async Task<IActionResult> DeleteTip(Guid id, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var entry = await _db.TipPoolEntries
            .FirstOrDefaultAsync(t => t.Id == id && t.CompanyId == CompanyId, ct);
        if (entry is null) return NotFound();

        _db.TipPoolEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("adjustments")]
    public async Task<IActionResult> AddAdjustment([FromBody] AddCommissionAdjustmentRequest req, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var user = await _db.AdminUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == req.UserId && u.CompanyId == CompanyId && u.Role != "admin", ct);
        if (user is null) return BadRequest(new { error = "Colaborador inválido." });
        if (req.AmountCents == 0) return BadRequest(new { error = "Ajuste deve ser diferente de zero." });

        var adjustment = new EmployeeCommissionAdjustment
        {
            CompanyId = CompanyId,
            AdminUserId = req.UserId,
            ReferenceDateUtc = req.ReferenceDateUtc?.Date ?? DateTime.UtcNow.Date,
            AmountCents = req.AmountCents,
            Description = req.Description?.Trim() ?? "",
            CreatedBy = UserName,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.EmployeeCommissionAdjustments.Add(adjustment);
        await _db.SaveChangesAsync(ct);
        return Ok(adjustment);
    }

    [HttpDelete("adjustments/{id:guid}")]
    public async Task<IActionResult> DeleteAdjustment(Guid id, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var item = await _db.EmployeeCommissionAdjustments
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == CompanyId, ct);
        if (item is null) return NotFound();

        _db.EmployeeCommissionAdjustments.Remove(item);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct = default)
    {
        var allowed = await IsCommissionsAllowedAsync(ct);
        if (!allowed) return Forbid();

        var cfg = await GetOrCreateConfigAsync(ct);
        var (startUtc, endExclusiveUtc) = ResolveRange(from, to);

        var team = await _db.AdminUsers
            .AsNoTracking()
            .Where(u => u.CompanyId == CompanyId && u.Role != "admin")
            .OrderBy(u => u.Username)
            .ToListAsync(ct);

        var customRates = await _db.EmployeeCommissionRates
            .AsNoTracking()
            .Where(r => r.CompanyId == CompanyId && r.IsActive)
            .ToListAsync(ct);

        var sales = await _db.SaleOrders
            .AsNoTracking()
            .Where(o => o.CompanyId == CompanyId &&
                        o.Status == SaleOrderStatus.Completed &&
                        o.CompletedAtUtc.HasValue &&
                        o.CompletedAtUtc.Value >= startUtc &&
                        o.CompletedAtUtc.Value < endExclusiveUtc)
            .Select(o => new { o.CashSessionId, o.TotalCents })
            .ToListAsync(ct);

        var sessionIds = sales.Select(s => s.CashSessionId).Distinct().ToList();

        var sessions = await _db.CashSessions
            .AsNoTracking()
            .Where(s => s.CompanyId == CompanyId && sessionIds.Contains(s.Id))
            .Select(s => new { s.Id, s.OpenedByUserId, s.OpenedByUserName })
            .ToListAsync(ct);

        var sessionMap = sessions.ToDictionary(s => s.Id, s => s);

        var salesByUser = new Dictionary<Guid, int>();
        var unassignedSalesCents = 0;

        foreach (var sale in sales)
        {
            if (!sessionMap.TryGetValue(sale.CashSessionId, out var session))
            {
                unassignedSalesCents += sale.TotalCents;
                continue;
            }

            var matchedId = team.FirstOrDefault(t => t.Id == session.OpenedByUserId)?.Id
                            ?? team.FirstOrDefault(t =>
                                string.Equals(t.Username, session.OpenedByUserName, StringComparison.OrdinalIgnoreCase))?.Id;

            if (matchedId is null)
            {
                unassignedSalesCents += sale.TotalCents;
                continue;
            }

            if (!salesByUser.ContainsKey(matchedId.Value)) salesByUser[matchedId.Value] = 0;
            salesByUser[matchedId.Value] += sale.TotalCents;
        }

        var tipsTotalCents = await _db.TipPoolEntries
            .Where(t => t.CompanyId == CompanyId &&
                        t.ReferenceDateUtc >= startUtc &&
                        t.ReferenceDateUtc < endExclusiveUtc)
            .SumAsync(t => (int?)t.AmountCents, ct) ?? 0;

        var adjustments = await _db.EmployeeCommissionAdjustments
            .AsNoTracking()
            .Where(a => a.CompanyId == CompanyId &&
                        a.ReferenceDateUtc >= startUtc &&
                        a.ReferenceDateUtc < endExclusiveUtc)
            .ToListAsync(ct);

        var rows = team.Select(user =>
        {
            var salesCents = salesByUser.GetValueOrDefault(user.Id);
            var rate = customRates.FirstOrDefault(r => r.AdminUserId == user.Id);
            var percent = rate?.CommissionPercent ?? cfg.DefaultCommissionPercent;
            var commissionCents = (int)Math.Round(salesCents * (percent / 100m), MidpointRounding.AwayFromZero);
            var adjustmentCents = adjustments.Where(a => a.AdminUserId == user.Id).Sum(a => a.AmountCents);

            return new EmployeeCommissionSummaryRow(
                user.Id,
                user.Username,
                user.Role,
                user.IsActive,
                percent,
                salesCents,
                commissionCents,
                0,
                adjustmentCents,
                commissionCents + adjustmentCents
            );
        }).ToList();

        var tipsEnabled = cfg.IsTipEnabled && tipsTotalCents > 0;
        if (tipsEnabled)
        {
            AllocateTips(rows, cfg.TipDistributionMode, tipsTotalCents);
        }

        var payableTotal = rows.Sum(r => r.TotalPayableCents);

        return Ok(new
        {
            from = startUtc,
            to = endExclusiveUtc.AddDays(-1),
            config = cfg,
            totals = new
            {
                salesCents = rows.Sum(r => r.SalesCents),
                commissionCents = rows.Sum(r => r.CommissionCents),
                tipsCents = rows.Sum(r => r.TipsCents),
                adjustmentsCents = rows.Sum(r => r.AdjustmentsCents),
                payableCents = payableTotal,
                unassignedSalesCents
            },
            employees = rows
        });
    }

    private async Task<bool> IsCommissionsAllowedAsync(CancellationToken ct)
    {
        var company = await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == CompanyId, ct);
        if (company is null) return false;

        var features = await _features.ResolveFeaturesAsync(company, ct);
        return features.GetValueOrDefault(AppFeatureKeys.Commissions);
    }

    private async Task<CommissionConfig> GetOrCreateConfigAsync(CancellationToken ct)
    {
        var cfg = await _db.CommissionConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == CompanyId, ct);

        if (cfg is not null) return cfg;

        cfg = new CommissionConfig
        {
            CompanyId = CompanyId
        };
        _db.CommissionConfigs.Add(cfg);
        await _db.SaveChangesAsync(ct);
        return cfg;
    }

    private static (DateTime StartUtc, DateTime EndExclusiveUtc) ResolveRange(DateTime? from, DateTime? to)
    {
        var end = (to?.Date ?? DateTime.UtcNow.Date).Date;
        var start = (from?.Date ?? end.AddDays(-29)).Date;
        if (start > end) (start, end) = (end, start);
        return (start, end.AddDays(1));
    }

    private static void AllocateTips(List<EmployeeCommissionSummaryRow> rows, string mode, int totalTipsCents)
    {
        var eligible = rows.Where(r => r.SalesCents > 0).ToList();
        if (eligible.Count == 0 || totalTipsCents <= 0) return;

        Dictionary<Guid, int> allocation = mode switch
        {
            "equal" => AllocateEqual(eligible, totalTipsCents),
            "proportional_commission" => AllocateProportional(
                eligible,
                totalTipsCents,
                r => r.CommissionCents),
            _ => AllocateProportional(
                eligible,
                totalTipsCents,
                r => r.SalesCents),
        };

        foreach (var row in rows)
        {
            var tips = allocation.GetValueOrDefault(row.UserId);
            row.TipsCents = tips;
            row.TotalPayableCents = row.CommissionCents + row.AdjustmentsCents + tips;
        }
    }

    private static Dictionary<Guid, int> AllocateEqual(List<EmployeeCommissionSummaryRow> rows, int total)
    {
        var perUser = total / rows.Count;
        var remainder = total - (perUser * rows.Count);
        var result = rows.ToDictionary(r => r.UserId, _ => perUser);
        for (var i = 0; i < remainder; i++)
            result[rows[i % rows.Count].UserId] += 1;
        return result;
    }

    private static Dictionary<Guid, int> AllocateProportional(
        List<EmployeeCommissionSummaryRow> rows,
        int total,
        Func<EmployeeCommissionSummaryRow, int> weightSelector)
    {
        var weights = rows.ToDictionary(r => r.UserId, r => Math.Max(0, weightSelector(r)));
        var sum = weights.Values.Sum();
        if (sum <= 0) return AllocateEqual(rows, total);

        var result = rows.ToDictionary(r => r.UserId, _ => 0);
        var distributed = 0;

        foreach (var row in rows)
        {
            var part = (int)Math.Floor((decimal)total * weights[row.UserId] / sum);
            result[row.UserId] = part;
            distributed += part;
        }

        var remainder = total - distributed;
        for (var i = 0; i < remainder; i++)
        {
            var userId = rows[i % rows.Count].UserId;
            result[userId] += 1;
        }

        return result;
    }
}

public class EmployeeCommissionSummaryRow
{
    public EmployeeCommissionSummaryRow(
        Guid userId,
        string username,
        string role,
        bool isActive,
        decimal commissionPercent,
        int salesCents,
        int commissionCents,
        int tipsCents,
        int adjustmentsCents,
        int totalPayableCents)
    {
        UserId = userId;
        Username = username;
        Role = role;
        IsActive = isActive;
        CommissionPercent = commissionPercent;
        SalesCents = salesCents;
        CommissionCents = commissionCents;
        TipsCents = tipsCents;
        AdjustmentsCents = adjustmentsCents;
        TotalPayableCents = totalPayableCents;
    }

    public Guid UserId { get; }
    public string Username { get; }
    public string Role { get; }
    public bool IsActive { get; }
    public decimal CommissionPercent { get; }
    public int SalesCents { get; }
    public int CommissionCents { get; }
    public int TipsCents { get; set; }
    public int AdjustmentsCents { get; }
    public int TotalPayableCents { get; set; }
}

public record UpsertCommissionConfigRequest(
    bool? IsEnabled,
    bool? IsTipEnabled,
    decimal? DefaultCommissionPercent,
    string? TipDistributionMode
);

public record SetEmployeeRateRequest(decimal CommissionPercent);
public record AddTipEntryRequest(DateTime? ReferenceDateUtc, int AmountCents, string? Description);
public record AddCommissionAdjustmentRequest(Guid UserId, DateTime? ReferenceDateUtc, int AmountCents, string? Description);
