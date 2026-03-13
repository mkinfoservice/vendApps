using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Petshop.Api.Services.Scale;
using System.Security.Claims;

namespace Petshop.Api.Controllers;

/// <summary>
/// Endpoints de integração com balança para o PDV.
/// </summary>
[ApiController]
[Route("pdv/scale")]
[Authorize(Roles = "admin,gerente,atendente")]
public class ScaleController : ControllerBase
{
    private readonly ScaleBarcodeParser _parser;

    public ScaleController(ScaleBarcodeParser parser)
    {
        _parser = parser;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirstValue("companyId")!);

    /// <summary>
    /// Interpreta um código de barras lido pelo scanner no PDV.
    ///
    /// Se o código for um barcode de balança (EAN-13 prefixo "2"), retorna o produto,
    /// o peso/preço calculado e os dados para adicionar ao carrinho.
    ///
    /// Se NÃO for um barcode de balança, retorna Success = false e o PDV trata como
    /// código convencional (busca por EAN normal).
    /// </summary>
    [HttpPost("parse-barcode")]
    public async Task<IActionResult> ParseBarcode(
        [FromBody] ParseBarcodeRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Barcode))
            return BadRequest(new { error = "Barcode não informado." });

        // Otimização: verificação rápida sem banco antes de consultar
        if (!ScaleBarcodeParser.IsScaleBarcode(req.Barcode))
            return Ok(new { IsScaleBarcode = false });

        var result = await _parser.ParseAsync(req.Barcode, CompanyId, ct);

        if (!result.Success)
            return Ok(new
            {
                IsScaleBarcode = true,
                result.Success,
                result.ErrorMessage
            });

        return Ok(new
        {
            IsScaleBarcode   = true,
            result.Success,
            result.ProductId,
            result.ProductName,
            result.ScaleProductCode,
            BarcodeMode      = result.BarcodeMode.ToString(),
            result.WeightKg,
            result.GrossWeightGrams,
            result.TareGrams,
            result.TotalPriceCents,
            result.PricePerKgCents,
            result.Quantity,
            result.OriginalBarcode
        });
    }
}

public record ParseBarcodeRequest(string Barcode);
