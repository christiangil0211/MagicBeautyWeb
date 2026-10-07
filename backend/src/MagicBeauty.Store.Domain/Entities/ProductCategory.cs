namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Tabla puente de la relacion N:N entre producto y categoria.
/// </summary>
public sealed class ProductCategory
{
    public int ProductId { get; set; }

    public Product? Product { get; set; }

    public int CategoryId { get; set; }

    public Category? Category { get; set; }
}
