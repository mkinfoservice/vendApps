using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Scale;

/// <summary>
/// Representa um serviço Windows (Scale Agent) instalado em um PC da loja.
/// O agente conecta via SignalR e gerencia os dispositivos de balança locais.
/// </summary>
public class ScaleAgent
{
    public Guid   Id          { get; set; } = Guid.NewGuid();
    public Guid   CompanyId   { get; set; }

    /// <summary>Chave secreta usada pelo serviço Windows para obter JWT e conectar ao hub.</summary>
    public string AgentKey    { get; set; } = string.Empty;

    /// <summary>Nome de identificação (ex: "PC Frente de Caixa").</summary>
    public string MachineName { get; set; } = string.Empty;

    /// <summary>Atualizado pelo hub ao conectar/desconectar.</summary>
    public bool      IsOnline    { get; set; }
    public DateTime? LastSeenUtc { get; set; }
    public string?   Notes       { get; set; }
    public DateTime  CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Company Company { get; set; } = null!;
    public ICollection<ScaleDevice> Devices { get; set; } = [];
}
