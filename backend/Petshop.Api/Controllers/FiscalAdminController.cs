using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Petshop.Api.Data;
using Petshop.Api.Entities.Fiscal;
using Petshop.Api.Entities.Pdv;
using Petshop.Api.Services.Fiscal;
using Petshop.Api.Services.Fiscal.Jobs;
using Petshop.Api.Services.WhatsApp;
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
    private readonly AppDbContext        _db;
    private readonly SefazHttpClient     _sefaz;
    private readonly IBackgroundJobClient _jobs;

    public FiscalAdminController(AppDbContext db, SefazHttpClient sefaz, IBackgroundJobClient jobs)
    {
        _db    = db;
        _sefaz = sefaz;
        _jobs  = jobs;
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
        cfg.CertificateBase64   = dto.CertificateBase64;
        cfg.CertificatePassword = dto.CertificatePassword;
        cfg.CertificatePath     = dto.CertificatePath; // legado
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
        return Ok(new { online, uf = cfg.Uf, env = cfg.SefazEnvironment.ToString(), checkedAtUtc = DateTime.UtcNow });
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

        // Prefere config do caixa; fallback para config empresa (legado)
        CashRegisterFiscalConfig? regCfg = null;
        if (sale.CashRegisterId != Guid.Empty)
            regCfg = await _db.CashRegisterFiscalConfigs
                .FirstOrDefaultAsync(f => f.CashRegisterId == sale.CashRegisterId, ct);

        FiscalConfig? compCfg = null;
        if (regCfg == null)
            compCfg = await _db.FiscalConfigs.FirstOrDefaultAsync(f => f.CompanyId == CompanyId, ct);

        var html = BuildDanfeHtml(sale, fiscalDoc, regCfg, compCfg);
        return Content(html, "text/html; charset=utf-8");
    }

    private static string BuildDanfeHtml(
        Entities.Pdv.SaleOrder sale,
        FiscalDocument? fiscalDoc,
        CashRegisterFiscalConfig? regCfg,
        FiscalConfig? compCfg)
    {
        // Resolve dados do emitente da fonte disponível
        var razaoSocial   = regCfg?.RazaoSocial   ?? compCfg?.RazaoSocial   ?? "—";
        var nomeFantasia  = regCfg?.NomeFantasia   ?? compCfg?.NomeFantasia;
        var cnpj          = regCfg?.Cnpj           ?? compCfg?.Cnpj          ?? "";
        var ie            = regCfg?.InscricaoEstadual ?? compCfg?.InscricaoEstadual ?? "";
        var logradouro    = regCfg?.Logradouro     ?? compCfg?.Logradouro    ?? "";
        var numero        = regCfg?.NumeroEndereco ?? compCfg?.NumeroEndereco ?? "";
        var complemento   = regCfg?.Complemento   ?? compCfg?.Complemento;
        var bairro        = regCfg?.Bairro         ?? compCfg?.Bairro        ?? "";
        var municipio     = regCfg?.NomeMunicipio  ?? compCfg?.NomeMunicipio ?? "";
        var uf            = regCfg?.Uf             ?? compCfg?.Uf            ?? "";
        var cep           = regCfg?.Cep            ?? compCfg?.Cep           ?? "";
        var telefone      = regCfg?.Telefone       ?? compCfg?.Telefone;
        var cscToken      = regCfg?.CscToken       ?? compCfg?.CscToken;
        var sefazEnv      = regCfg?.SefazEnvironment ?? compCfg?.SefazEnvironment ?? SefazEnvironment.Homologacao;

        static string Brl(int cents) => $"R$ {cents / 100m:F2}".Replace(".", ",");
        static string Enc(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");

        // Formata CNPJ: 00.000.000/0001-00
        var cnpjFmt = cnpj.Length == 14
            ? $"{cnpj[..2]}.{cnpj[2..5]}.{cnpj[5..8]}/{cnpj[8..12]}-{cnpj[12..]}"
            : cnpj;

        // Formata CEP: 00000-000
        var cepFmt = cep.Length == 8 ? $"{cep[..5]}-{cep[5..]}" : cep;

        var enderecoLine1 = $"{logradouro}, {numero}{(string.IsNullOrWhiteSpace(complemento) ? "" : " - " + complemento)}";
        var enderecoLine2 = $"{bairro} - {municipio}/{uf} - CEP {cepFmt}";

        var authorized = fiscalDoc?.FiscalStatus == FiscalDocumentStatus.Authorized;
        var chave      = fiscalDoc?.AccessKey ?? "";
        var chaveFormatted = chave.Length == 44
            ? string.Concat(Enumerable.Range(0, 11).Select(i => chave.Substring(i * 4, 4) + " ")).Trim()
            : chave;

        var nNF = fiscalDoc != null
            ? $"NFC-e Nº {fiscalDoc.Number:D9}  Série {fiscalDoc.Serie:D3}"
            : "NFC-e (não autorizada)";

        var dataEmissao = sale.CompletedAtUtc?.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss") ?? "—";

        // Itens
        var itemRows = string.Join("", sale.Items.Select((i, idx) =>
        {
            var qtdStr  = i.IsSoldByWeight ? $"{i.WeightKg:F3} kg" : $"{i.Qty:F0} UN";
            var unitStr = Brl(i.UnitPriceCentsSnapshot);
            return $@"<tr>
  <td colspan='3' class='item-desc'>{idx + 1:D2} {Enc(i.ProductNameSnapshot)}</td>
</tr>
<tr>
  <td class='item-qty'>{Enc(qtdStr)}</td>
  <td class='item-unit'>x {unitStr}</td>
  <td class='item-total'>{Brl(i.TotalCents)}</td>
</tr>";
        }));

        // Pagamentos
        var payRows = string.Join("", sale.Payments.Select(p =>
        {
            var label = p.PaymentMethod.ToUpper() switch
            {
                "PIX"            => "PIX",
                "DINHEIRO"       => "Dinheiro",
                "CARTAO_CREDITO" => "Cartão Crédito",
                "CARTAO_DEBITO"  => "Cartão Débito",
                _                => p.PaymentMethod
            };
            var changeRow = p.ChangeCents > 0
                ? $"<tr><td>Troco</td><td class='right'>{Brl(p.ChangeCents)}</td></tr>"
                : "";
            return $"<tr><td>{label}</td><td class='right'>{Brl(p.AmountCents)}</td></tr>{changeRow}";
        }));

        // QR Code URL (SEFAZ RJ homologação/produção)
        var qrBaseUrl = SefazEndpoints.GetQrCodeBaseUrl(uf.Length == 2 ? uf : "RJ", sefazEnv);
        var qrContent = authorized && chave.Length == 44
            ? $"{qrBaseUrl}?p={chave}|2|1|1|{GenerateQrHash(chave, cscToken ?? "")}"
            : "";

        // Protocolo
        var protocoloLine = authorized
            ? $"<p>Protocolo: {fiscalDoc!.AuthorizationCode}  {fiscalDoc.AuthorizationDateTimeUtc?.ToLocalTime().ToString("dd/MM/yyyy HH:mm:ss")}</p>"
            : $"<p class='contingencia'>⚠ {(sale.FiscalDecision == "PermanentContingency" ? "Venda em contingência — NFC-e não emitida" : "Aguardando autorização SEFAZ")}</p>";

        // Texto PROCON obrigatório RJ
        const string proconText = "SAC e PROCON: O consumidor pode exigir o Documento Fiscal. " +
            "Guarde este cupom. Acesse www.procon.rj.gov.br ou ligue 151.";

        return $@"<!DOCTYPE html>
<html lang='pt-BR'>
<head>
<meta charset='utf-8'/>
<meta name='viewport' content='width=device-width'/>
<title>DANFE NFC-e</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:'Courier New',monospace;font-size:10px;width:80mm;max-width:80mm;padding:3mm;color:#000;background:#fff;}}
h1{{text-align:center;font-size:13px;font-weight:bold;margin:2px 0;}}
h2{{text-align:center;font-size:11px;font-weight:bold;margin:1px 0;}}
.center{{text-align:center;}}
.right{{text-align:right;}}
p{{font-size:9px;margin:1px 0;}}
hr{{border:none;border-top:1px dashed #555;margin:4px 0;}}
table{{width:100%;border-collapse:collapse;}}
td{{padding:1px 0;font-size:10px;vertical-align:top;}}
.item-desc{{font-size:10px;padding-top:3px;}}
.item-qty{{width:25%;color:#333;}}
.item-unit{{width:30%;color:#333;}}
.item-total{{width:45%;text-align:right;font-weight:bold;}}
.total-row td{{font-size:12px;font-weight:bold;padding:3px 0;}}
.subtotal td{{font-size:10px;}}
.chave{{font-size:7.5px;word-break:break-all;text-align:center;letter-spacing:0.5px;margin:2px 0;}}
.procon{{font-size:8px;text-align:center;color:#444;margin:3px 0;border:1px solid #ccc;padding:3px;border-radius:2px;}}
.contingencia{{color:#c00;text-align:center;font-weight:bold;font-size:9px;}}
.danfe-title{{text-align:center;font-size:9px;color:#555;margin:2px 0;}}
#qr{{display:flex;justify-content:center;margin:4px 0;}}
@media print{{@page{{margin:0;size:80mm auto;}}body{{padding:2mm;}}}}
</style>
</head>
<body>

<!-- Cabeçalho emitente -->
<h1>{Enc(razaoSocial)}</h1>
{(string.IsNullOrWhiteSpace(nomeFantasia) ? "" : $"<h2>{Enc(nomeFantasia)}</h2>")}
<p class='center'>{Enc(enderecoLine1)}</p>
<p class='center'>{Enc(enderecoLine2)}</p>
{(string.IsNullOrWhiteSpace(telefone) ? "" : $"<p class='center'>Tel: {Enc(telefone)}</p>")}
<p class='center'>CNPJ: {Enc(cnpjFmt)}{(string.IsNullOrWhiteSpace(ie) ? "" : $"  IE: {Enc(ie)}")}</p>

<hr/>
<p class='danfe-title'>DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA</p>
<p class='danfe-title'>{Enc(nNF)}</p>
<p class='center'>Emissão: {dataEmissao}</p>
<hr/>

<!-- Itens -->
<table>
<thead>
<tr><th colspan='3' style='text-align:left;font-size:9px;color:#555;padding-bottom:2px;'>ITENS</th></tr>
</thead>
<tbody>{itemRows}</tbody>
</table>
<hr/>

<!-- Totais -->
<table class='subtotal'>
<tr><td>Subtotal</td><td class='right'>{Brl(sale.SubtotalCents)}</td></tr>
{(sale.DiscountCents > 0 ? $"<tr><td>Desconto</td><td class='right'>-{Brl(sale.DiscountCents)}</td></tr>" : "")}
</table>
<table>
<tr class='total-row'><td>TOTAL</td><td class='right'>{Brl(sale.TotalCents)}</td></tr>
</table>
<hr/>

<!-- Formas de pagamento -->
<p style='font-size:9px;color:#555;margin-bottom:2px;'>PAGAMENTO</p>
<table>{payRows}</table>
<hr/>

<!-- Consumidor -->
<p class='center' style='font-size:9px;'>CONSUMIDOR {(string.IsNullOrWhiteSpace(sale.CustomerName) ? "NÃO IDENTIFICADO" : Enc(sale.CustomerName))}</p>
<hr/>

<!-- Protocolo / Status fiscal -->
{protocoloLine}

{(authorized && qrContent.Length > 0 ? $@"<hr/>
<!-- QR Code -->
<p class='center' style='font-size:8px;margin-bottom:2px;'>Consulte a NFC-e pela chave ou QR Code</p>
<div id='qr'></div>
<p class='chave'>{Enc(chaveFormatted)}</p>
<p class='center' style='font-size:8px;'>Consulte em nfce.fazenda.rj.gov.br</p>" : "")}

<hr/>
<!-- PROCON -->
<div class='procon'>{proconText}</div>
<hr/>
<p class='center' style='margin-top:4px;font-size:10px;'>Obrigado pela preferência!</p>

{(authorized && qrContent.Length > 0 ? $@"<script src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'></script>
<script>
new QRCode(document.getElementById('qr'),{{
  text: {System.Text.Json.JsonSerializer.Serialize(qrContent)},
  width:120,height:120,correctLevel:QRCode.CorrectLevel.M
}});
window.onload=function(){{setTimeout(function(){{window.print();}},600);}};
</script>" : "<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>")}
</body>
</html>";
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

    // ── Debug / Testes ────────────────────────────────────────────────────────

    /// <summary>
    /// Enfileira o WhatsApp de comprovante para uma venda já existente (mock ou real).
    /// Útil para testar PDF + upload + envio sem precisar passar pelo fluxo fiscal completo.
    /// Apenas admin — não expor em produção para usuários finais.
    /// </summary>
    [HttpPost("debug/sale/{saleId:guid}/notify-whatsapp")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DebugNotifyWhatsApp(Guid saleId, CancellationToken ct)
    {
        var exists = await _db.SaleOrders
            .AnyAsync(s => s.Id == saleId && s.CompanyId == CompanyId, ct);

        if (!exists)
            return NotFound("Venda não encontrada.");

        var jobId = _jobs.Enqueue<WhatsAppNotificationService>(
            s => s.NotifySaleCompletedAsync(saleId, CancellationToken.None));

        return Ok(new { jobId, message = "Job enfileirado. Acompanhe em /hangfire." });
    }

    /// <summary>
    /// Reprocessa a fila fiscal da empresa manualmente (dispara o FiscalQueueProcessorJob).
    /// Útil para testar o fluxo completo: fiscal → WhatsApp em sequência.
    /// </summary>
    [HttpPost("debug/process-queue")]
    [Authorize(Roles = "admin")]
    public IActionResult DebugProcessFiscalQueue()
    {
        var jobId = _jobs.Enqueue<FiscalQueueProcessorJob>(
            j => j.ProcessAsync(CompanyId, CancellationToken.None));

        return Ok(new { jobId, message = "Job fiscal enfileirado. Acompanhe em /hangfire." });
    }

    // ── QR Code hash helper ───────────────────────────────────────────────────

    private static string GenerateQrHash(string chave, string cscToken)
    {
        // Hash SHA-1 da concatenação chave+cToken para o QR Code NFC-e (NT 2015/002)
        var input = chave + cscToken;
        var bytes = System.Security.Cryptography.SHA1.HashData(System.Text.Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
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
        CertificateBase64  = cfg.CertificateBase64,
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
    public string?  CertificateBase64  { get; set; }
    public string?  CertificatePassword { get; set; }
    public string?  CertificatePath    { get; set; } // legado
    public string?  CscId             { get; set; }
    public string?  CscToken          { get; set; }
    public short    NfceSerie         { get; set; } = 1;
    public string?  DefaultCfop       { get; set; } = "5102";
}
