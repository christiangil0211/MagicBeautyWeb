
namespace MagicBeauty.Store.Domain.Entities;

public sealed class Product
{
    public int Id { get; set; }

    /// <summary>
    /// Referencia comercial que digita el administrador: 3 letras + 3 numeros.
    /// Es inmutable una vez creado el producto: una referencia nueva es un producto nuevo.
    /// </summary>
    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int BrandId { get; set; }

    public Brand? Brand { get; set; }

    /// <summary>
    /// Indica si el cliente debe elegir un tono antes de comprar. Cuando es false
    /// el producto conserva una unica variante interna para el inventario.
    /// </summary>
    public bool HasVariants { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<ProductCategory> ProductCategories { get; set; } = new List<ProductCategory>();

    public ICollection<ProductPrice> Prices { get; set; } = new List<ProductPrice>();

    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
}
