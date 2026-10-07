namespace MagicBeauty.Store.Contracts.Categories.Responses;

/// <summary>
/// Tarjeta de la sección "Compra por categoría" del inicio.
/// </summary>
public sealed class CategoryTileDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }
}
