namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class ProductListItemDto
{
    public int Id { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int BrandId { get; set; }

    public string BrandName { get; set; } = string.Empty;

    public bool HasVariants { get; set; }

    public bool IsActive { get; set; }

    /// <summary>Suma de las existencias de las variantes activas.</summary>
    public int TotalQuantity { get; set; }

    /// <summary>Importe del tipo de precio predeterminado. Null si todavia no se cargo.</summary>
    public decimal? DefaultPrice { get; set; }

    public string? MainImageUrl { get; set; }

    /// <summary>Nombres de las categorias asociadas, para la columna del listado.</summary>
    public List<string> Categories { get; set; } = [];
}
