using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Fiscal;

namespace Petshop.Api.Entities.Pdv;

/// <summary>
/// Configuração fiscal individual de um terminal PDV (1:1 com CashRegister).
/// Permite múltiplos CNPJs diferentes no mesmo tenant — ex: 3 empresas diferentes
/// no mesmo endereço compartilhando o mesmo banco de produtos.
/// </summary>
public class CashRegisterFiscalConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CashRegisterId { get; set; }
    public CashRegister CashRegister { get; set; } = default!;

    // ── Dados da empresa emissora ──────────────────────────────────────

    /// <summary>CNPJ somente dígitos (14 chars).</summary>
    [MaxLength(14)]
    public string Cnpj { get; set; } = "";

    [MaxLength(30)]
    public string InscricaoEstadual { get; set; } = "";

    /// <summary>UF do estabelecimento (ex: RJ, SP, MG).</summary>
    [MaxLength(2)]
    public string Uf { get; set; } = "";

    [MaxLength(60)]
    public string RazaoSocial { get; set; } = "";

    [MaxLength(60)]
    public string? NomeFantasia { get; set; }

    [MaxLength(60)]
    public string Logradouro { get; set; } = "";

    [MaxLength(60)]
    public string NumeroEndereco { get; set; } = "";

    [MaxLength(60)]
    public string? Complemento { get; set; }

    [MaxLength(60)]
    public string Bairro { get; set; } = "";

    /// <summary>Código IBGE do município (7 dígitos).</summary>
    public int CodigoMunicipio { get; set; }

    [MaxLength(60)]
    public string NomeMunicipio { get; set; } = "";

    /// <summary>CEP somente dígitos (8 chars).</summary>
    [MaxLength(8)]
    public string Cep { get; set; } = "";

    [MaxLength(14)]
    public string? Telefone { get; set; }

    // ── Tributação ────────────────────────────────────────────────────

    public TaxRegime TaxRegime { get; set; } = TaxRegime.SimplesNacional;

    /// <summary>CFOP padrão de saída para varejo (ex: 5102).</summary>
    [MaxLength(10)]
    public string DefaultCfop { get; set; } = "5102";

    // ── SEFAZ ─────────────────────────────────────────────────────────

    public SefazEnvironment SefazEnvironment { get; set; } = SefazEnvironment.Homologacao;

    // ── Certificado Digital (A1) ───────────────────────────────────────

    /// <summary>Conteúdo do .pfx em Base64 — cloud-friendly (sem filesystem).</summary>
    public string? CertificateBase64 { get; set; }

    [MaxLength(1000)]
    public string? CertificatePassword { get; set; }

    // ── NFC-e / CSC ───────────────────────────────────────────────────

    [MaxLength(10)]
    public string? CscId { get; set; }

    [MaxLength(36)]
    public string? CscToken { get; set; }

    /// <summary>Série NFC-e padrão deste terminal (1-999).</summary>
    public short NfceSerie { get; set; } = 1;

    // ── Status ────────────────────────────────────────────────────────

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
