namespace MagicBeauty.Store.Contracts.Categories.Responses;

/// <summary>
/// Nodo del menú de la tienda pública. Solo expone lo que necesita el storefront.
/// </summary>
public sealed class CategoryMenuDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public List<CategoryMenuDto> Children { get; set; } = [];
}
