using System.ComponentModel.DataAnnotations;

namespace Petshop.Api.Entities.Pdv;

/// <summary>Tipo de movimento de caixa.</summary>
public enum CashMovementType
{
    Sangria    = 0,  // retirada de numerário (ex: recolhimento parcial)
    Suprimento = 1,  // reforço de numerário (ex: adicionar troco)
}

/// <summary>
/// Registro de sangria ou suprimento durante uma sessão de caixa.
/// Afeta o cálculo do saldo esperado no fechamento.
/// </summary>
public class CashMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }

    public Guid CashSessionId { get; set; }
    public CashSession CashSession { get; set; } = default!;

    public CashMovementType Type { get; set; }

    /// <summary>Valor em centavos (sempre positivo; Type define o sentido).</summary>
    public int AmountCents { get; set; }

    [MaxLength(200)]
    public string Description { get; set; } = "";

    [MaxLength(120)]
    public string OperatorName { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
