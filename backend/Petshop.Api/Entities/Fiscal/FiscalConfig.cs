using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Fiscal;

/// <summary>
/// Configuração fiscal por empresa (1:1 com Company).
/// Contém dados do SEFAZ, certificado digital, CSC e regras tributárias.
/// </summary>
public class FiscalConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company? Company { get; set; }

    // ── Dados da empresa ─────────────────────────────────────────────

    /// <summary>CNPJ somente dígitos (sem pontos/barras).</summary>
    [MaxLength(14)]
    public string Cnpj { get; set; } = "";

    [MaxLength(30)]
    public string InscricaoEstadual { get; set; } = "";

    /// <summary>UF do estabelecimento (ex: SP, RS, MG).</summary>
    [MaxLength(2)]
    public string Uf { get; set; } = "";

    public TaxRegime TaxRegime { get; set; } = TaxRegime.SimplesNacional;

    // ── SEFAZ ────────────────────────────────────────────────────────

    public SefazEnvironment SefazEnvironment { get; set; } = SefazEnvironment.Homologacao;

    // ── Certificado Digital (A1) ──────────────────────────────────────

    /// <summary>
    /// Caminho para o arquivo .pfx/.p12 do certificado digital.
    /// O arquivo NÃO é armazenado no banco — apenas o path.
    /// Fase futura: migrar para HSM ou Azure Key Vault.
    /// </summary>
    [MaxLength(500)]
    public string? CertificatePath { get; set; }

    /// <summary>Senha do certificado (fase futura: criptografar via Data Protection).</summary>
    [MaxLength(200)]
    public string? CertificatePassword { get; set; }

    // ── NFC-e ─────────────────────────────────────────────────────────

    /// <summary>ID do CSC (Código de Segurança do Contribuinte) para NFC-e.</summary>
    [MaxLength(10)]
    public string? CscId { get; set; }

    /// <summary>Token CSC — usado para gerar o QR Code da NFC-e.</summary>
    [MaxLength(36)]
    public string? CscToken { get; set; }

    /// <summary>Série padrão da NFC-e (1 a 999). Cada caixa pode ter sua própria série.</summary>
    public short NfceSerie { get; set; } = 1;

    // ── Dados do estabelecimento (Fase 5) ────────────────────────────────

    /// <summary>Razão social completa (até 60 chars conforme SEFAZ).</summary>
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

    /// <summary>Código IBGE do município (7 dígitos, ex: 3550308 = São Paulo).</summary>
    public int CodigoMunicipio { get; set; }

    [MaxLength(60)]
    public string NomeMunicipio { get; set; } = "";

    /// <summary>CEP somente dígitos (8 chars).</summary>
    [MaxLength(8)]
    public string Cep { get; set; } = "";

    [MaxLength(14)]
    public string? Telefone { get; set; }

    // ── Tributação ───────────────────────────────────────────────────

    /// <summary>CFOP padrão de saída para operações de varejo (ex: 5102 = venda de mercadoria para revenda).</summary>
    [MaxLength(10)]
    public string DefaultCfop { get; set; } = "5102";

    // ── Status ───────────────────────────────────────────────────────

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
