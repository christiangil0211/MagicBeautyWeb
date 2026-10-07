namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Catalogo de tipos de precio. Permite agregar nuevos tipos sin tocar Product.
/// </summary>
public sealed class PriceType
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Tipo que ve un usuario no autenticado. Solo uno puede estar marcado.</summary>
    public bool IsDefault { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<ProductPrice> ProductPrices { get; set; } = new List<ProductPrice>();
}
