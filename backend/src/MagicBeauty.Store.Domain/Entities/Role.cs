namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Rol comercial de un usuario autenticado. Los tipos de precio que ve se
/// configuran en <see cref="RolePriceTypes"/>, nunca en el codigo.
/// </summary>
public sealed class Role
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public ICollection<RolePriceType> RolePriceTypes { get; set; } = new List<RolePriceType>();

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
