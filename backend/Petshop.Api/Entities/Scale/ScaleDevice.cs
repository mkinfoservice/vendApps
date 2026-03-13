namespace Petshop.Api.Entities.Scale;

/// <summary>
/// Dispositivo de balança físico conectado a um Scale Agent via porta serial.
/// </summary>
public class ScaleDevice
{
    public Guid   Id        { get; set; } = Guid.NewGuid();
    public Guid   AgentId   { get; set; }
    public Guid   CompanyId { get; set; }

    /// <summary>Nome amigável (ex: "Balança Açougue").</summary>
    public string     Name       { get; set; } = string.Empty;
    public ScaleModel ScaleModel { get; set; } = ScaleModel.FilizolaP;

    /// <summary>Porta serial (ex: "COM1", "COM3").</summary>
    public string PortName { get; set; } = "COM1";
    public int    BaudRate { get; set; } = 9600;
    public bool   IsActive { get; set; } = true;

    /// <summary>Última vez que uma sincronização foi concluída com sucesso.</summary>
    public DateTime? LastSyncUtc  { get; set; }
    public DateTime  CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ScaleAgent Agent { get; set; } = null!;
}
