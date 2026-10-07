namespace MagicBeauty.Store.Contracts.Products.Responses;

/// <summary>
/// Ficha publica del producto. A diferencia de <see cref="ProductDto"/> nunca viaja
/// el desglose de precios comerciales ni la variante interna: el consumidor solo
/// recibe el precio que le aplica.
/// </summary>
public sealed class ProductDetailDto
{
    public int Id { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string BrandName { get; set; } = string.Empty;

    /// <summary>Importe del tipo de precio predeterminado. Null si todavia no se cargo.</summary>
    public decimal? Price { get; set; }

    public bool HasVariants { get; set; }

    /// <summary>Existencias sumadas de las variantes activas.</summary>
    public int AvailableQuantity { get; set; }

    public List<ProductDetailCategoryDto> Categories { get; set; } = [];

    public List<ProductDetailImageDto> Images { get; set; } = [];

    /// <summary>Vacia cuando el producto no maneja tonos.</summary>
    public List<ProductDetailVariantDto> Variants { get; set; } = [];
}

public sealed class ProductDetailCategoryDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;
}

public sealed class ProductDetailImageDto
{
    public int Id { get; set; }

    /// <summary>Null cuando la imagen es general del producto.</summary>
    public int? ProductVariantId { get; set; }

    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsMain { get; set; }
}

public sealed class ProductDetailVariantDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? ColorHex { get; set; }

    public int Quantity { get; set; }

    public int DisplayOrder { get; set; }
}
