namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class CreateProductRequest
{
    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int BrandId { get; set; }

    public bool HasVariants { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Existencias de la variante interna. Solo se usa cuando HasVariants es false.</summary>
    public int InitialQuantity { get; set; }

    public List<int> CategoryIds { get; set; } = [];

    /// <summary>Debe incluir el tipo de precio marcado como predeterminado.</summary>
    public List<UpsertProductPriceRequest> Prices { get; set; } = [];

    /// <summary>Obligatorio y no vacio cuando HasVariants es true.</summary>
    public List<CreateProductVariantRequest> Variants { get; set; } = [];
}
