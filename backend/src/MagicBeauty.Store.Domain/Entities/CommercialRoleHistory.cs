namespace MagicBeauty.Store.Domain.Entities;

public enum CommercialRoleChangeReason { Approval, Manual, Expired }

/// <summary>Registra cada cambio de condición comercial y el operador que lo decidió, si lo hubo.</summary>
public sealed class CommercialRoleHistory
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int? PreviousRoleId { get; set; }
    public Role? PreviousRole { get; set; }
    public int NewRoleId { get; set; }
    public Role? NewRole { get; set; }
    public CommercialRoleChangeReason Reason { get; set; }
    public int? ActorUserId { get; set; }
    public User? Actor { get; set; }
    public DateTimeOffset ChangedAt { get; set; }
}
