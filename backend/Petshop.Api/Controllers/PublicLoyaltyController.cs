using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Promotions;
using Petshop.Api.Services;
using Petshop.Api.Services.Customers;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("public/loyalty")]
public class PublicLoyaltyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TenantResolverService _tenantResolver;
    private readonly CpfProtectionService _cpfProtection;
    private readonly LoyaltyService _loyalty;
    private readonly IDataProtector _sessionProtector;

    public PublicLoyaltyController(
        AppDbContext db,
        TenantResolverService tenantResolver,
        CpfProtectionService cpfProtection,
        LoyaltyService loyalty,
        IDataProtectionProvider dataProtectionProvider)
    {
        _db = db;
        _tenantResolver = tenantResolver;
        _cpfProtection = cpfProtection;
        _loyalty = loyalty;
        _sessionProtector = dataProtectionProvider.CreateProtector("public:loyalty:session:v1");
    }

    [HttpPost("session")]
    [EnableRateLimiting("public_api")]
    public async Task<IActionResult> CreateSession(
        [FromBody] CreateLoyaltySessionRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Phone))
            return BadRequest(new { error = "Telefone obrigatório." });

        var cpf = CpfValidator.Normalize(req.Cpf);
        if (!CpfValidator.IsValid(cpf))
            return BadRequest(new { error = "CPF inválido." });

        var company = await ResolveCompanyAsync(req.Slug, ct);
        if (company is null)
            return NotFound(new { error = "Empresa não encontrada." });

        var phone = NormalizePhoneDigits(req.Phone);
        if (phone.Length < 10)
            return BadRequest(new { error = "Telefone inválido." });

        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == company.Id && c.Phone == phone)
            .FirstOrDefaultAsync(ct);

        if (customer is null)
            return NotFound(new { error = "Cliente não encontrado." });

        if (string.IsNullOrWhiteSpace(customer.CpfHash))
            return Unauthorized(new { error = "Cliente não habilitado para fidelidade digital." });

        var cpfHash = _cpfProtection.Hash(cpf!);
        if (!string.Equals(customer.CpfHash, cpfHash, StringComparison.Ordinal))
            return Unauthorized(new { error = "Dados de identificação inválidos." });

        var expiresAt = DateTime.UtcNow.AddMinutes(30);
        var payload = $"{company.Id:N}|{customer.Id:N}|{expiresAt.Ticks}";
        var token = _sessionProtector.Protect(payload);

        return Ok(new
        {
            sessionToken = token,
            expiresAtUtc = expiresAt,
            customer = new
            {
                customerId = customer.Id,
                name = customer.Name,
                pointsBalance = customer.PointsBalance
            }
        });
    }

    [HttpGet("dashboard")]
    [EnableRateLimiting("public_api")]
    public async Task<IActionResult> Dashboard(
        [FromHeader(Name = "X-Loyalty-Session")] string? sessionToken,
        CancellationToken ct)
    {
        var session = ParseSession(sessionToken);
        if (session is null) return Unauthorized(new { error = "Sessão inválida ou expirada." });

        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == session.CompanyId && c.Id == session.CustomerId)
            .FirstOrDefaultAsync(ct);
        if (customer is null) return Unauthorized(new { error = "Cliente não encontrado." });

        var config = await _loyalty.GetOrCreateConfigAsync(session.CompanyId, ct);
        var now = DateTime.UtcNow;

        var rewardsQuery = _db.Promotions
            .AsNoTracking()
            .Where(p => p.CompanyId == session.CompanyId &&
                        p.IsActive &&
                        p.CouponCode != null &&
                        p.LoyaltyPointsCost != null &&
                        p.LoyaltyPointsCost > 0 &&
                        (p.StartsAtUtc == null || p.StartsAtUtc <= now) &&
                        (p.ExpiresAtUtc == null || p.ExpiresAtUtc >= now));

        var rewardsRaw = await rewardsQuery
            .OrderBy(p => p.LoyaltyPointsCost)
            .ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.CouponCode,
                p.LoyaltyPointsCost,
                p.Scope,
                p.TargetId
            })
            .ToListAsync(ct);

        var productTargetIds = rewardsRaw
            .Where(r => r.Scope == PromotionScope.Product && r.TargetId.HasValue)
            .Select(r => r.TargetId!.Value)
            .Distinct()
            .ToList();

        var imageMap = productTargetIds.Count == 0
            ? new Dictionary<Guid, string?>()
            : await _db.Products
                .AsNoTracking()
                .Where(p => p.CompanyId == session.CompanyId && productTargetIds.Contains(p.Id))
                .Select(p => new { p.Id, p.ImageUrl })
                .ToDictionaryAsync(x => x.Id, x => x.ImageUrl, ct);

        var redeemedPromotionIds = await _db.LoyaltyTransactions
            .AsNoTracking()
            .Where(t => t.CompanyId == session.CompanyId &&
                        t.CustomerId == session.CustomerId &&
                        t.Points < 0 &&
                        t.Description.Contains("Resgate beneficio ["))
            .Select(t => t.Description)
            .ToListAsync(ct);

        var redeemedSet = new HashSet<Guid>();
        foreach (var description in redeemedPromotionIds)
        {
            var id = ExtractPromotionId(description);
            if (id.HasValue) redeemedSet.Add(id.Value);
        }

        var transactions = await _db.LoyaltyTransactions
            .AsNoTracking()
            .Where(t => t.CompanyId == session.CompanyId && t.CustomerId == session.CustomerId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(100)
            .Select(t => new
            {
                t.Id,
                t.Points,
                t.BalanceBefore,
                t.BalanceAfter,
                t.Description,
                t.CreatedAtUtc
            })
            .ToListAsync(ct);

        var rewards = rewardsRaw.Select(r => new
        {
            id = r.Id,
            name = r.Name,
            description = r.Description,
            couponCode = r.CouponCode,
            pointsCost = r.LoyaltyPointsCost,
            imageUrl = r.Scope == PromotionScope.Product && r.TargetId.HasValue
                ? imageMap.GetValueOrDefault(r.TargetId.Value)
                : null,
            isRedeemed = redeemedSet.Contains(r.Id),
            isAvailable = customer.PointsBalance >= (r.LoyaltyPointsCost ?? int.MaxValue)
        });

        return Ok(new
        {
            customer = new
            {
                customerId = customer.Id,
                name = customer.Name,
                pointsBalance = customer.PointsBalance
            },
            loyaltyConfig = new
            {
                config.IsEnabled,
                config.MinRedemptionPoints,
                config.PointsPerReal,
                config.PointsPerReais
            },
            rewards,
            transactions
        });
    }

    [HttpPost("redeem")]
    [EnableRateLimiting("public_api")]
    public async Task<IActionResult> Redeem(
        [FromHeader(Name = "X-Loyalty-Session")] string? sessionToken,
        [FromBody] RedeemLoyaltyRewardRequest req,
        CancellationToken ct)
    {
        var session = ParseSession(sessionToken);
        if (session is null) return Unauthorized(new { error = "Sessão inválida ou expirada." });
        if (req.PromotionId == Guid.Empty) return BadRequest(new { error = "Benefício inválido." });

        var requestId = ParseOrCreateRequestId(req.IdempotencyKey);
        try
        {
            var result = await _loyalty.RedeemPromotionAsync(
                session.CompanyId,
                session.CustomerId,
                req.PromotionId,
                requestId,
                ct);

            return Ok(new
            {
                promotionId = result.PromotionId,
                promotionName = result.PromotionName,
                couponCode = result.CouponCode,
                pointsSpent = result.PointsSpent,
                pointsBalance = result.PointsBalance,
                isReplay = result.IsIdempotentReplay
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task<Entities.Catalog.Company?> ResolveCompanyAsync(string? slugFromRequest, CancellationToken ct)
    {
        var slug = slugFromRequest?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(slug))
            slug = _tenantResolver.ExtractSlug(Request.Host.Host);

        if (string.IsNullOrWhiteSpace(slug))
            return null;

        return await _db.Companies
            .AsNoTracking()
            .Where(c => c.Slug == slug && c.IsActive && !c.IsDeleted)
            .FirstOrDefaultAsync(ct);
    }

    private LoyaltySessionPayload? ParseSession(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var raw = _sessionProtector.Unprotect(token);
            var parts = raw.Split('|');
            if (parts.Length != 3) return null;
            if (!Guid.TryParseExact(parts[0], "N", out var companyId)) return null;
            if (!Guid.TryParseExact(parts[1], "N", out var customerId)) return null;
            if (!long.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var ticks)) return null;
            var expiresAt = new DateTime(ticks, DateTimeKind.Utc);
            if (expiresAt <= DateTime.UtcNow) return null;
            return new LoyaltySessionPayload(companyId, customerId, expiresAt);
        }
        catch
        {
            return null;
        }
    }

    private static Guid ParseOrCreateRequestId(string? idempotencyKey)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey) &&
            Guid.TryParse(idempotencyKey.Trim(), out var parsed))
            return parsed;

        Span<byte> bytes = stackalloc byte[16];
        RandomNumberGenerator.Fill(bytes);
        return new Guid(bytes);
    }

    private static string NormalizePhoneDigits(string value) =>
        Regex.Replace(value, @"\D", "");

    private static Guid? ExtractPromotionId(string description)
    {
        var match = Regex.Match(description, @"Resgate beneficio \[(?<id>[A-Fa-f0-9\-]{36})\]");
        if (!match.Success) return null;
        if (!Guid.TryParse(match.Groups["id"].Value, out var id)) return null;
        return id;
    }

    private sealed record LoyaltySessionPayload(Guid CompanyId, Guid CustomerId, DateTime ExpiresAtUtc);
}

public sealed class CreateLoyaltySessionRequest
{
    public string? Slug { get; init; }
    public string Phone { get; init; } = "";
    public string Cpf { get; init; } = "";
}

public sealed class RedeemLoyaltyRewardRequest
{
    public Guid PromotionId { get; init; }
    public string? IdempotencyKey { get; init; }
}
