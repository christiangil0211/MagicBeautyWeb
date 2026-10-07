namespace MagicBeauty.Store.Contracts.Products.Responses;

/// <summary>
/// Vista de administracion: incluye todos los precios comerciales y la variante
/// interna. No debe usarse para el catalogo publico.
/// </summary>
public sealed class ProductDto
{
    public int Id { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int BrandId { get; set; }

    public string BrandName { get; set; } = string.Empty;

    public bool HasVariants { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<ProductCategoryDto> Categories { get; set; } = [];

    public List<ProductPriceDto> Prices { get; set; } = [];

    public List<ProductVariantDto> Variants { get; set; } = [];

    public List<ProductImageDto> Images { get; set; } = [];
}
