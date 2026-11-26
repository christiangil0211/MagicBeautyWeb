using MagicBeauty.Store.Contracts.Catalog.Responses;

namespace MagicBeauty.Store.Contracts.Brands.Responses;

/// <summary>Marca en la tienda pública: solo activas y con productos completos.</summary>
public sealed class PublicBrandDto
{
    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? LogoUrl { get; set; }

    public string? Description { get; set; }

    public bool IsFeatured { get; set; }

    /// <summary>Productos completos (activos, con foto y precio al detal).</summary>
    public int ProductCount { get; set; }
}

/// <summary>Página pública de una marca con sus productos completos, paginados.</summary>
public sealed class PublicBrandPageDto
{
    public PublicBrandDto Brand { get; set; } = new();

    public List<CatalogProductListItemDto> Products { get; set; } = [];

    public int Total { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }
}
