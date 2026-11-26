namespace MagicBeauty.Store.Contracts.Categories.Requests;

public sealed class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Slug { get; set; } = string.Empty;

    public int? ParentCategoryId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public bool ShowInHome { get; set; }

    /// <summary>Carrusel de productos de esta categoría (y sus subcategorías) en el inicio. Máximo 5.</summary>
    public bool ShowAsHomeCarousel { get; set; }

    public bool ShowInNavigation { get; set; } = true;

    public bool ShowInMegaMenu { get; set; }
}