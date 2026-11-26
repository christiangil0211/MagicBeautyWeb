namespace MagicBeauty.Store.Contracts.Brands.Responses;

/// <summary>Página de productos para la gestión de una marca en el administrador.</summary>
public sealed class BrandProductsPageDto
{
    public List<BrandProductItemDto> Items { get; set; } = [];

    public int Total { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }
}

public sealed class BrandProductItemDto
{
    public int Id { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string? MainImageUrl { get; set; }

    /// <summary>Marca actual; NULL si no tiene.</summary>
    public int? BrandId { get; set; }

    public string? BrandName { get; set; }
}
