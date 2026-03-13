using System.ComponentModel.DataAnnotations;
using Petshop.Api.Entities.Catalog;

namespace Petshop.Api.Entities.Agenda;

public enum AppointmentStatus
{
    Scheduled  = 0,  // Agendado
    CheckedIn  = 1,  // Pet chegou
    InProgress = 2,  // Em execução
    Done       = 3,  // Concluído
    Cancelled  = 4,  // Cancelado
    NoShow     = 5,  // Não compareceu
}

public class ServiceAppointment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = default!;

    public Guid ServiceTypeId { get; set; }
    public ServiceType ServiceType { get; set; } = default!;

    /// <summary>Data e hora agendada (armazenada sem conversão de fuso).</summary>
    public DateTime ScheduledAt { get; set; }

    [Required, MaxLength(80)]
    public string PetName { get; set; } = "";

    [MaxLength(80)]
    public string? PetBreed { get; set; }

    [Required, MaxLength(120)]
    public string CustomerName { get; set; } = "";

    [MaxLength(20)]
    public string? CustomerPhone { get; set; }

    /// <summary>Profissional responsável.</summary>
    [MaxLength(120)]
    public string? OperatorName { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;

    /// <summary>Valor cobrado em centavos (pode diferir do preço padrão do serviço).</summary>
    public int PriceCents { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    // Timestamps de eventos
    public DateTime? CheckedInAt  { get; set; }
    public DateTime? StartedAt    { get; set; }
    public DateTime? DoneAt       { get; set; }
    public DateTime? CancelledAt  { get; set; }

    /// <summary>Referência ao lançamento financeiro gerado ao finalizar.</summary>
    public Guid? FinancialEntryId { get; set; }

    public DateTime  CreatedAtUtc  { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc  { get; set; }
}
