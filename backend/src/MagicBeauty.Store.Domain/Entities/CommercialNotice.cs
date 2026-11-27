namespace MagicBeauty.Store.Domain.Entities;

public enum CommercialNoticeKind { Reminder, Expired }

/// <summary>Evita enviar más de un aviso del mismo tipo por ciclo y conserva el intento.</summary>
public sealed class CommercialNotice
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int RoleId { get; set; }
    public Role? Role { get; set; }
    public string Source { get; set; } = string.Empty;
    public long AssignmentId { get; set; }
    public DateOnly PurchaseOn { get; set; }
    public DateOnly DueOn { get; set; }
    public CommercialNoticeKind Kind { get; set; }
    public DateTimeOffset? AttemptedAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
}
