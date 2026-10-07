namespace MagicBeauty.Store.Domain.Entities;

/// <summary>Tipo de precio que un rol tiene autorizado ver.</summary>
public sealed class RolePriceType
{
    public int RoleId { get; set; }

    public Role? Role { get; set; }

    public int PriceTypeId { get; set; }

    public PriceType? PriceType { get; set; }
}
