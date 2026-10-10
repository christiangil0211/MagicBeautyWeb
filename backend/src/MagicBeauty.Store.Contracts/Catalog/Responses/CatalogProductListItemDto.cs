namespace MagicBeauty.Store.Contracts.Catalog.Responses;

/// <summary>
/// Tarjeta publica de producto. No incluye conceptos de administracion ni
/// precios que la audiencia actual no puede ver.
/// </summary>
public sealed class CatalogProductListItemDto
{
    public int Id { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string BrandName { get; set; } = string.Empty;

    public bool HasVariants { get; set; }

    /// <summary>Existencias sumadas de las variantes activas.</summary>
    public int AvailableQuantity { get; set; }

    public string? MainImageUrl { get; set; }

    /// <summary>
    /// Categorias asignadas directamente al producto. Permiten filtrar y contar por
    /// categoria en la tienda sin una consulta por cada una.
    /// </summary>
    public List<int> CategoryIds { get; set; } = [];

    /// <summary>Vacia si el producto no tiene ningun precio visible para la audiencia.</summary>
    public List<CatalogPriceDto> Prices { get; set; } = [];
}
