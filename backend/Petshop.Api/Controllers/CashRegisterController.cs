using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Services.Fiscal;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>CRUD de terminais PDV — gerenciado pelo admin/gerente.</summary>
[ApiController]
[Route("admin/cash-registers")]
[Authorize(Roles = "admin,gerente")]
public class CashRegisterController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FiscalCertProtectionService _certSvc;

    public CashRegisterController(AppDbContext db, FiscalCertProtectionService certSvc)
    {
        _db      = db;
        _certSvc = certSvc;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── GET /admin/cash-registers ─────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var registers = await _db.CashRegisters
            .AsNoTracking()
            .Where(r => r.CompanyId == CompanyId)
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.FiscalSerie,
                r.FiscalAutoIssuePix,
                r.FiscalSendCashToSefaz,
                r.IsActive,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            })
            .ToListAsync(ct);

        return Ok(registers);
    }

    // ── GET /admin/cash-registers/{id} ────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await _db.CashRegisters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);

        if (r is null) return NotFound("Terminal não encontrado.");

        return Ok(new
        {
            r.Id, r.Name, r.FiscalSerie,
            r.FiscalAutoIssuePix, r.FiscalSendCashToSefaz,
            r.IsActive, r.CreatedAtUtc, r.UpdatedAtUtc
        });
    }

    // ── POST /admin/cash-registers ────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateCashRegisterRequest req,
        CancellationToken ct)
    {
        var register = new CashRegister
        {
            CompanyId            = CompanyId,
            Name                 = req.Name,
            FiscalSerie          = req.FiscalSerie ?? "001",
            FiscalAutoIssuePix   = req.FiscalAutoIssuePix ?? true,
            FiscalSendCashToSefaz = req.FiscalSendCashToSefaz ?? false,
            IsActive             = true
        };

        _db.CashRegisters.Add(register);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = register.Id },
            new { register.Id, register.Name });
    }

    // ── PUT /admin/cash-registers/{id} ────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateCashRegisterRequest req,
        CancellationToken ct)
    {
        var r = await _db.CashRegisters
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == CompanyId, ct);

        if (r is null) return NotFound("Terminal não encontrado.");

        if (req.Name         != null) r.Name                  = req.Name;
        if (req.FiscalSerie  != null) r.FiscalSerie            = req.FiscalSerie;
        if (req.FiscalAutoIssuePix.HasValue)
            r.FiscalAutoIssuePix = req.FiscalAutoIssuePix.Value;
        if (req.FiscalSendCashToSefaz.HasValue)
            r.FiscalSendCashToSefaz = req.FiscalSendCashToSefaz.Value;
        if (req.IsActive.HasValue)
            r.IsActive = req.IsActive.Value;

        r.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── GET /admin/cash-registers/{id}/fiscal ────────────────────────────────
    /// <summary>Retorna a configuração fiscal do terminal (ou objeto vazio se ainda não configurado).</summary>
    [HttpGet("{id:guid}/fiscal")]
    public async Task<IActionResult> GetFiscal(Guid id, CancellationToken ct)
    {
        var register = await _db.CashRegisters
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && r.CompanyId == CompanyId, ct);

        if (register is null) return NotFound("Terminal não encontrado.");

        var cfg = await _db.CashRegisterFiscalConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.CashRegisterId == id, ct);

        if (cfg == null) return Ok(new CashRegisterFiscalConfigDto());
        return Ok(MapFiscalToDto(cfg));
    }

    // ── PUT /admin/cash-registers/{id}/fiscal ────────────────────────────────
    /// <summary>Salva (upsert) a configuração fiscal do terminal.</summary>
    [HttpPut("{id:guid}/fiscal")]
    public async Task<IActionResult> SaveFiscal(
        Guid id,
        [FromBody] CashRegisterFiscalConfigDto dto,
        CancellationToken ct)
    {
        var register = await _db.CashRegisters
            .FirstOrDefaultAsync(r => r.Id == id && r.CompanyId == CompanyId, ct);

        if (register is null) return NotFound("Terminal não encontrado.");

        var cfg = await _db.CashRegisterFiscalConfigs
            .FirstOrDefaultAsync(f => f.CashRegisterId == id, ct);

        if (cfg == null)
        {
            cfg = new CashRegisterFiscalConfig { CashRegisterId = id };
            _db.CashRegisterFiscalConfigs.Add(cfg);
        }

        cfg.Cnpj                = dto.Cnpj?.Replace(".", "").Replace("/", "").Replace("-", "") ?? "";
        cfg.InscricaoEstadual   = dto.InscricaoEstadual ?? "";
        cfg.Uf                  = dto.Uf?.ToUpperInvariant() ?? "";
        cfg.RazaoSocial         = dto.RazaoSocial ?? "";
        cfg.NomeFantasia        = dto.NomeFantasia;
        cfg.Logradouro          = dto.Logradouro ?? "";
        cfg.NumeroEndereco      = dto.NumeroEndereco ?? "";
        cfg.Complemento         = dto.Complemento;
        cfg.Bairro              = dto.Bairro ?? "";
        cfg.CodigoMunicipio     = dto.CodigoMunicipio;
        cfg.NomeMunicipio       = dto.NomeMunicipio ?? "";
        cfg.Cep                 = dto.Cep?.Replace("-", "") ?? "";
        cfg.Telefone            = dto.Telefone;
        cfg.TaxRegime           = Enum.Parse<TaxRegime>(dto.TaxRegime ?? "SimplesNacional");
        cfg.SefazEnvironment    = Enum.Parse<SefazEnvironment>(dto.SefazEnvironment ?? "Homologacao");
        if (!string.IsNullOrWhiteSpace(dto.CertificateBase64))
            cfg.CertificateBase64 = _certSvc.Protect(dto.CertificateBase64);
        if (!string.IsNullOrWhiteSpace(dto.CertificatePassword))
            cfg.CertificatePassword = _certSvc.Protect(dto.CertificatePassword);
        cfg.CscId               = dto.CscId;
        cfg.CscToken            = dto.CscToken;
        cfg.NfceSerie           = dto.NfceSerie > 0 ? dto.NfceSerie : (short)1;
        cfg.DefaultCfop         = dto.DefaultCfop ?? "5102";
        cfg.IsActive            = true;
        cfg.UpdatedAtUtc        = DateTime.UtcNow;

        // Sincroniza também a série no CashRegister (para compatibilidade com PDV)
        register.FiscalSerie   = cfg.NfceSerie.ToString("D3");
        register.UpdatedAtUtc  = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(MapFiscalToDto(cfg));
    }

    // ── GET /admin/cash-registers/{id}/fiscal/status ─────────────────────────
    [HttpGet("{id:guid}/fiscal/status")]
    public async Task<IActionResult> FiscalStatus(Guid id, CancellationToken ct)
    {
        var cfg = await _db.CashRegisterFiscalConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.CashRegisterId == id, ct);

        if (cfg == null) return BadRequest(new { error = "Configuração fiscal não encontrada para este terminal." });

        // Usa SefazHttpClient injetado via DI seria mais limpo, mas para manter a estrutura atual:
        return Ok(new
        {
            hasConfig      = true,
            uf             = cfg.Uf,
            env            = cfg.SefazEnvironment.ToString(),
            cnpj           = cfg.Cnpj,
            razaoSocial    = cfg.RazaoSocial,
            hasCert        = !string.IsNullOrWhiteSpace(cfg.CertificateBase64),
            checkedAtUtc   = DateTime.UtcNow,
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static CashRegisterFiscalConfigDto MapFiscalToDto(CashRegisterFiscalConfig cfg) => new()
    {
        Cnpj               = cfg.Cnpj,
        InscricaoEstadual  = cfg.InscricaoEstadual,
        Uf                 = cfg.Uf,
        RazaoSocial        = cfg.RazaoSocial,
        NomeFantasia       = cfg.NomeFantasia,
        Logradouro         = cfg.Logradouro,
        NumeroEndereco     = cfg.NumeroEndereco,
        Complemento        = cfg.Complemento,
        Bairro             = cfg.Bairro,
        CodigoMunicipio    = cfg.CodigoMunicipio,
        NomeMunicipio      = cfg.NomeMunicipio,
        Cep                = cfg.Cep,
        Telefone           = cfg.Telefone,
        TaxRegime          = cfg.TaxRegime.ToString(),
        SefazEnvironment   = cfg.SefazEnvironment.ToString(),
        // Nunca retornamos o certificado criptografado ao frontend — só hasCert indica presença
        CertificateBase64  = null,
        CscId              = cfg.CscId,
        CscToken           = cfg.CscToken,
        NfceSerie          = cfg.NfceSerie,
        DefaultCfop        = cfg.DefaultCfop,
    };
}

public record CreateCashRegisterRequest(
    [Required, MaxLength(80)] string Name,
    [MaxLength(3)] string? FiscalSerie = null,
    bool? FiscalAutoIssuePix = null,
    bool? FiscalSendCashToSefaz = null
);

public record UpdateCashRegisterRequest(
    string? Name,
    string? FiscalSerie,
    bool? FiscalAutoIssuePix,
    bool? FiscalSendCashToSefaz,
    bool? IsActive
);

/// <summary>DTO de configuração fiscal por terminal — espelho de FiscalConfigDto.</summary>
public class CashRegisterFiscalConfigDto
{
    public string?  Cnpj               { get; set; }
    public string?  InscricaoEstadual  { get; set; }
    public string?  Uf                 { get; set; }
    public string?  RazaoSocial        { get; set; }
    public string?  NomeFantasia       { get; set; }
    public string?  Logradouro         { get; set; }
    public string?  NumeroEndereco     { get; set; }
    public string?  Complemento        { get; set; }
    public string?  Bairro             { get; set; }
    public int      CodigoMunicipio    { get; set; }
    public string?  NomeMunicipio      { get; set; }
    public string?  Cep                { get; set; }
    public string?  Telefone           { get; set; }
    public string?  TaxRegime          { get; set; } = "SimplesNacional";
    public string?  SefazEnvironment   { get; set; } = "Homologacao";
    public string?  CertificateBase64  { get; set; }
    public string?  CertificatePassword { get; set; }
    public string?  CscId              { get; set; }
    public string?  CscToken           { get; set; }
    public short    NfceSerie          { get; set; } = 1;
    public string?  DefaultCfop        { get; set; } = "5102";
}

// ── Admin: histórico de sessões ────────────────────────────────────────────────

[ApiController]
[Route("admin/pdv")]
[Authorize(Roles = "admin,gerente")]
public class PdvSessionAdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public PdvSessionAdminController(AppDbContext db) => _db = db;
    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // GET /admin/pdv/sessions
    [HttpGet("sessions")]
    public async Task<IActionResult> ListSessions(
        [FromQuery] Guid?   registerId = null,
        [FromQuery] string? status     = null,
        [FromQuery] int     page       = 1,
        CancellationToken   ct         = default)
    {
        var q = _db.CashSessions.AsNoTracking()
            .Include(s => s.CashRegister)
            .Where(s => s.CompanyId == CompanyId);

        if (registerId.HasValue) q = q.Where(s => s.CashRegisterId == registerId.Value);
        if (status == "Open")   q = q.Where(s => s.Status == CashSessionStatus.Open);
        if (status == "Closed") q = q.Where(s => s.Status == CashSessionStatus.Closed);

        const int pageSize = 20;
        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(s => s.OpenedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new {
                s.Id,
                RegisterName             = s.CashRegister.Name,
                s.OpenedByUserName,
                s.ClosedByUserName,
                Status                   = s.Status.ToString(),
                s.OpeningBalanceCents,
                s.ClosingBalanceCents,
                s.TotalSalesCount,
                s.TotalSalesCents,
                s.PermanentContingencyCount,
                s.OpenedAtUtc,
                s.ClosedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }
}
