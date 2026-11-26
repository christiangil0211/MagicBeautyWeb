namespace MagicBeauty.Store.Contracts.Categories.Responses;

/// <summary>
/// Carrusel de productos de una categoría en el inicio. Los productos se piden
/// aparte al catálogo con el Id (incluye las subcategorías).
/// </summary>
public sealed class CategoryCarouselDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;
}
