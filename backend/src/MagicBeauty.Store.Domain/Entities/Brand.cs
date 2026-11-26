namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Marca de los productos. Un producto tiene como máximo una (Product.BrandId);
/// un producto sin marca tiene BrandId NULL: no existe una marca "Sin marca".
/// </summary>
public sealed class Brand
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Única: forma la URL pública /marcas/{slug}.</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Un solo logo por marca (Blob). NULL si todavía no se ha cargado.</summary>
    public string? LogoUrl { get; set; }

    /// <summary>Texto corto opcional para la página de la marca.</summary>
    public string? Description { get; set; }

    /// <summary>Aparece en el carrusel de logos del inicio (si tiene logo).</summary>
    public bool IsFeatured { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
