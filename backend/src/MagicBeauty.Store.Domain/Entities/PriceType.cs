namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Catalogo de tipos de precio. Permite agregar nuevos tipos sin tocar Product.
/// </summary>
public sealed class PriceType
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Precio de referencia: todo producto debe tenerlo cargado. Solo uno puede estar
    /// marcado. No decide quien lo ve: eso lo resuelven IsPublic y RolePriceTypes.
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Politica de precios publicos: si un usuario no autenticado puede ver este tipo.
    /// Un tipo nuevo nace oculto y solo se publica de forma explicita.
    /// </summary>
    public bool IsPublic { get; set; }

    /// <summary>Orden en que la tienda presenta los precios.</summary>
    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<ProductPrice> ProductPrices { get; set; } = new List<ProductPrice>();

    public ICollection<RolePriceType> RolePriceTypes { get; set; } = new List<RolePriceType>();
}
