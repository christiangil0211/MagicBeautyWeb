namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Imagen del producto. Solo se guarda la URL y sus metadatos: los binarios
/// viven fuera de SQL Server.
/// </summary>
public sealed class ProductImage
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product? Product { get; set; }

    /// <summary>Null cuando la imagen es general del producto.</summary>
    public int? ProductVariantId { get; set; }

    public ProductVariant? ProductVariant { get; set; }

    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public int DisplayOrder { get; set; }

    /// <summary>Principal dentro de su contexto: del producto o de la variante.</summary>
    public bool IsMain { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
