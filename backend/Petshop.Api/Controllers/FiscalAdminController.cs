using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Services.Fiscal;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoints de administração fiscal: configuração, status SEFAZ, DANFE e cancelamento.
/// </summary>
[ApiController]
[Route("admin/fiscal")]
[Authorize(Roles = "admin,gerente")]
public class FiscalAdminController : ControllerBase
{
    private readonly AppDbContext    _db;
    private readonly SefazHttpClient _sefaz;

    public FiscalAdminController(AppDbContext db, SefazHttpClient sefaz)
    {
        _db    = db;
        _sefaz = sefaz;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    // ── Config ────────────────────────────────────────────────────────────────

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var cfg = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == CompanyId, ct);

        if (cfg == null)
            return Ok(new FiscalConfigDto());

        return Ok(MapToDto(cfg));
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] FiscalConfigDto dto, CancellationToken ct)
    {
        var cfg = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == CompanyId, ct);

        if (cfg == null)
        {
            cfg = new FiscalConfig { CompanyId = CompanyId };
            _db.FiscalConfigs.Add(cfg);
        }

        cfg.Cnpj               = dto.Cnpj?.Replace(".", "").Replace("/", "").Replace("-", "") ?? "";
        cfg.InscricaoEstadual  = dto.InscricaoEstadual ?? "";
        cfg.Uf                 = dto.Uf?.ToUpperInvariant() ?? "";
        cfg.RazaoSocial        = dto.RazaoSocial ?? "";
        cfg.NomeFantasia       = dto.NomeFantasia;
        cfg.Logradouro         = dto.Logradouro ?? "";
        cfg.NumeroEndereco     = dto.NumeroEndereco ?? "";
        cfg.Complemento        = dto.Complemento;
        cfg.Bairro             = dto.Bairro ?? "";
        cfg.CodigoMunicipio    = dto.CodigoMunicipio;
        cfg.NomeMunicipio      = dto.NomeMunicipio ?? "";
        cfg.Cep                = dto.Cep?.Replace("-", "") ?? "";
        cfg.Telefone           = dto.Telefone;
        cfg.TaxRegime          = Enum.Parse<TaxRegime>(dto.TaxRegime ?? "SimplesNacional");
        cfg.SefazEnvironment   = Enum.Parse<SefazEnvironment>(dto.SefazEnvironment ?? "Homologacao");
        cfg.CertificatePath    = dto.CertificatePath;
        cfg.CertificatePassword = dto.CertificatePassword;
        cfg.CscId              = dto.CscId;
        cfg.CscToken           = dto.CscToken;
        cfg.NfceSerie          = dto.NfceSerie;
        cfg.DefaultCfop        = dto.DefaultCfop ?? "5102";
        cfg.IsActive           = true;
        cfg.UpdatedAtUtc       = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(MapToDto(cfg));
    }

    // ── SEFAZ Status ──────────────────────────────────────────────────────────

    [HttpGet("status")]
    public async Task<IActionResult> SefazStatus(CancellationToken ct)
    {
        var cfg = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == CompanyId && f.IsActive, ct);

        if (cfg == null)
            return BadRequest(new { error = "FiscalConfig não configurado." });

        var online = await _sefaz.IsOnlineAsync(cfg.Uf, cfg.SefazEnvironment, ct);
        return Ok(new { online, uf = cfg.Uf, env = cfg.SefazEnvironment.ToString() });
    }

    // ── DANFE NFC-e ───────────────────────────────────────────────────────────

    [HttpGet("sale/{saleId:guid}/danfe")]
    public async Task<IActionResult> GetDanfe(Guid saleId, CancellationToken ct)
    {
        var sale = await _db.SaleOrders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == saleId && o.CompanyId == CompanyId, ct);

        if (sale == null) return NotFound();

        var fiscalDoc = sale.FiscalDocumentId.HasValue
            ? await _db.FiscalDocuments.FindAsync([sale.FiscalDocumentId.Value], ct)
            : null;

        var cfg = await _db.FiscalConfigs
            .FirstOrDefaultAsync(f => f.CompanyId == CompanyId, ct);

        var html = BuildDanfeHtml(sale, fiscalDoc, cfg);
        return Content(html, "text/html; charset=utf-8");
    }

    private static string BuildDanfeHtml(
        Entities.Pdv.SaleOrder sale,
        FiscalDocument? fiscalDoc,
        FiscalConfig? cfg)
    {
        var brl = (int cents) => $"R$ {cents / 100m:F2}".Replace(".", ",");
        var company = cfg?.RazaoSocial ?? "—";
        var chave   = fiscalDoc?.AccessKey ?? "NFC-e não autorizada";
        var nNF     = fiscalDoc != null ? $"NFC-e nº {fiscalDoc.Number:D9} Série {fiscalDoc.Serie:D3}" : "";
        var status  = fiscalDoc?.FiscalStatus.ToString() ?? sale.FiscalDecision;

        var items = string.Join("", sale.Items.Select(i =>
            $"<tr><td>{i.ProductNameSnapshot}</td><td style='text-align:right'>" +
            $"{(i.IsSoldByWeight ? $"{i.WeightKg:F3}kg" : $"{i.Qty}x")}</td>" +
            $"<td style='text-align:right'>{brl(i.TotalCents)}</td></tr>"));

        var pays = string.Join("", sale.Payments.Select(p =>
            $"<tr><td>{p.PaymentMethod}</td><td style='text-align:right'>{brl(p.AmountCents)}</td></tr>"));

        var chaveFormatted = chave.Length == 44
            ? string.Concat(Enumerable.Range(0, 11).Select(i => chave.Substring(i * 4, 4) + " ")).Trim()
            : chave;

        return $@"<!DOCTYPE html><html><head><meta charset='utf-8'/>
<style>*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:monospace;font-size:11px;width:80mm;padding:4mm;}}
h2{{text-align:center;font-size:13px;margin-bottom:4px;}}
p{{text-align:center;font-size:10px;color:#555;margin-bottom:4px;}}
hr{{border:none;border-top:1px dashed #999;margin:5px 0;}}
table{{width:100%;border-collapse:collapse;}}td{{padding:2px 0;}}
.total{{font-weight:bold;font-size:13px;}}
.chave{{font-size:8px;word-break:break-all;text-align:center;}}
.status{{text-align:center;font-size:10px;color:#888;}}
@media print{{@page{{margin:0;}}}}</style></head><body>
<h2>{System.Net.WebUtility.HtmlEncode(company)}</h2>
<p>{System.Net.WebUtility.HtmlEncode(nNF)}</p>
<p>{sale.CompletedAtUtc?.ToLocalTime().ToString("dd/MM/yyyy HH:mm") ?? "—"}</p>
<hr/>
<table>{items}</table>
<hr/>
<table>
<tr><td>Subtotal</td><td style='text-align:right'>{brl(sale.SubtotalCents)}</td></tr>
{(sale.DiscountCents > 0 ? $"<tr><td>Desconto</td><td style='text-align:right'>-{brl(sale.DiscountCents)}</td></tr>" : "")}
<tr class='total'><td>Total</td><td style='text-align:right'>{brl(sale.TotalCents)}</td></tr>
</table><hr/><table>{pays}</table>
{(fiscalDoc?.FiscalStatus == FiscalDocumentStatus.Authorized ? $@"<hr/>
<p class='chave'>CHAVE DE ACESSO</p>
<p class='chave'>{chaveFormatted}</p>
<p class='status'>Consulte em www.nfe.fazenda.gov.br</p>" : $"<hr/><p class='status'>{status}</p>")}
<hr/><p style='margin-top:6px'>Obrigado pela preferência!</p>
</body></html>";
    }

    // ── Documentos fiscais da empresa ─────────────────────────────────────────

    [HttpGet("documents")]
    public async Task<IActionResult> ListDocuments(
        [FromQuery] int page = 1,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        var q = _db.FiscalDocuments.Where(d => d.CompanyId == CompanyId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<FiscalDocumentStatus>(status, out var st))
            q = q.Where(d => d.FiscalStatus == st);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(d => d.CreatedAtUtc)
            .Skip((page - 1) * 50).Take(50)
            .Select(d => new
            {
                d.Id, d.Number, d.Serie, d.AccessKey,
                Status = d.FiscalStatus.ToString(),
                d.SaleOrderId, d.CreatedAtUtc, d.AuthorizationDateTimeUtc
            })
            .ToListAsync(ct);

        return Ok(new { total, page, items });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static FiscalConfigDto MapToDto(FiscalConfig cfg) => new()
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
        CertificatePath    = cfg.CertificatePath,
        CscId              = cfg.CscId,
        CscToken           = cfg.CscToken,
        NfceSerie          = cfg.NfceSerie,
        DefaultCfop        = cfg.DefaultCfop,
    };
}

// ── DTO ───────────────────────────────────────────────────────────────────────

public class FiscalConfigDto
{
    public string?  Cnpj              { get; set; }
    public string?  InscricaoEstadual { get; set; }
    public string?  Uf                { get; set; }
    public string?  RazaoSocial       { get; set; }
    public string?  NomeFantasia      { get; set; }
    public string?  Logradouro        { get; set; }
    public string?  NumeroEndereco    { get; set; }
    public string?  Complemento       { get; set; }
    public string?  Bairro            { get; set; }
    public int      CodigoMunicipio   { get; set; }
    public string?  NomeMunicipio     { get; set; }
    public string?  Cep               { get; set; }
    public string?  Telefone          { get; set; }
    public string?  TaxRegime         { get; set; } = "SimplesNacional";
    public string?  SefazEnvironment  { get; set; } = "Homologacao";
    public string?  CertificatePath   { get; set; }
    public string?  CertificatePassword { get; set; }
    public string?  CscId             { get; set; }
    public string?  CscToken          { get; set; }
    public short    NfceSerie         { get; set; } = 1;
    public string?  DefaultCfop       { get; set; } = "5102";
}
