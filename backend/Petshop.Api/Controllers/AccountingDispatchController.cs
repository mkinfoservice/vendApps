using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Petshop.Api.Services.Accounting;

namespace Petshop.Api.Controllers;

[ApiController]
[Route("admin/accounting-dispatch")]
[Authorize(Roles = "admin,gerente")]
public class AccountingDispatchController : ControllerBase
{
    private readonly AccountingDispatchService _dispatch;

    public AccountingDispatchController(AccountingDispatchService dispatch)
    {
        _dispatch = dispatch;
    }

    private Guid CompanyId => AccountingDispatchClaims.GetCompanyId(User);
    private string Actor => AccountingDispatchClaims.GetActor(User);

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        var cfg = await _dispatch.GetConfigDtoAsync(CompanyId, ct);
        return Ok(cfg);
    }

    [HttpPut("config")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SaveConfig(
        [FromBody] UpsertAccountingDispatchConfigRequest req,
        CancellationToken ct)
    {
        try
        {
            var cfg = await _dispatch.UpsertConfigAsync(CompanyId, req, Actor, ct);
            return Ok(cfg);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("test-email")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> TestEmail(CancellationToken ct)
    {
        try
        {
            await _dispatch.TestEmailAsync(CompanyId, Actor, ct);
            return Ok(new { message = "Email de teste enviado com sucesso." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("send-now")]
    [Authorize(Roles = "admin,gerente")]
    public async Task<IActionResult> SendNow([FromBody] SendNowRequest req, CancellationToken ct)
    {
        try
        {
            var run = await _dispatch.SendNowAsync(CompanyId, req, Actor, ct);
            return Ok(run);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        var data = await _dispatch.GetHistoryAsync(CompanyId, page, pageSize, status, ct);
        return Ok(data);
    }

    [HttpGet("history/{runId:guid}")]
    public async Task<IActionResult> HistoryDetail(Guid runId, CancellationToken ct)
    {
        var run = await _dispatch.GetRunDetailAsync(CompanyId, runId, ct);
        if (run is null) return NotFound(new { error = "Execucao nao encontrada." });
        return Ok(run);
    }

    [HttpPost("history/{runId:guid}/retry")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Retry(Guid runId, CancellationToken ct)
    {
        try
        {
            var run = await _dispatch.RetryAsync(CompanyId, runId, Actor, ct);
            return Ok(run);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
