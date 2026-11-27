namespace MagicBeauty.Store.Domain.Entities;

public enum RoleRequestStatus { Pending, Approved, Rejected }

/// <summary>Conserva la solicitud y la decisión sin conceder permisos mientras esté pendiente.</summary>
public sealed class RoleRequest
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int RequestedRoleId { get; set; }
    public Role? RequestedRole { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public RoleRequestStatus Status { get; set; }
    public string? Note { get; set; }
    public int? ReviewedByUserId { get; set; }
    public User? ReviewedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
