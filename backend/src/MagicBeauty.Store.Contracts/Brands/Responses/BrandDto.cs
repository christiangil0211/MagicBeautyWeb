namespace MagicBeauty.Store.Contracts.Brands.Responses;

/// <summary>Marca vista desde el administrador.</summary>
public sealed class BrandDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? LogoUrl { get; set; }

    public string? Description { get; set; }

    public bool IsFeatured { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    /// <summary>Productos con esta marca (activos e inactivos).</summary>
    public int ProductCount { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
