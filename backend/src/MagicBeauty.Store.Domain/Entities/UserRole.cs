namespace MagicBeauty.Store.Domain.Entities;

/// <summary>Rol asignado a un usuario. Reutiliza el catalogo Roles de la politica de precios.</summary>
public sealed class UserRole
{
    public int UserId { get; set; }

    public User? User { get; set; }

    public int RoleId { get; set; }

    public Role? Role { get; set; }
}
