namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Precio del producto para un tipo de precio. Todas las variantes de una
/// referencia comparten estos precios: el precio nunca vive en la variante.
/// </summary>
public sealed class ProductPrice
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product? Product { get; set; }

    public int PriceTypeId { get; set; }

    public PriceType? PriceType { get; set; }

    public decimal Amount { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
