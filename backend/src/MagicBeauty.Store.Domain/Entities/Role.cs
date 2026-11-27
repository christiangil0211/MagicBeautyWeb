namespace MagicBeauty.Store.Domain.Entities;

public enum RoleKind { Internal, Commercial }

/// <summary>
/// Rol interno o comercial. La matriz define qué precios habilitan los roles comerciales.
/// </summary>
public sealed class Role
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public RoleKind Kind { get; set; }

    public bool IsSelfRequestable { get; set; }

    public int? RepurchaseDays { get; set; }

    public ICollection<RolePriceType> RolePriceTypes { get; set; } = new List<RolePriceType>();

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
