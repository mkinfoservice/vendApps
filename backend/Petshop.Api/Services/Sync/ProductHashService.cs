using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Calcula um hash SHA256 estável do estado normalizado de um produto externo.
/// Usado para detectar alterações sem re-comparar todos os campos.
/// </summary>
public class ProductHashService
{
    public string ComputeHash(ExternalProductDto dto)
    {
        // Campos que definem o "conteúdo" do produto — excluindo ExternalId e RawHash propositalmente
        var payload = new
        {
            dto.Name,
            dto.Description,
            dto.CategoryName,
            dto.BrandName,
            dto.Unit,
            dto.CostCents,
            dto.PriceCents,
            dto.StockQty,
            dto.IsActive,
            dto.Ncm,
            dto.Barcode,
            dto.InternalCode,
            dto.ImageUrl
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
