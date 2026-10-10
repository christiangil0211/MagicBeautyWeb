namespace MagicBeauty.Store.Contracts.TraditionalCatalogs.Responses;

/// <summary>Detalle de administracion.</summary>
public sealed class TraditionalCatalogDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string CanvaEmbedUrl { get; set; } = string.Empty;

    /// <summary>Enlace para abrir el catalogo en Canva (el que se compartio).</summary>
    public string CanvaShareUrl { get; set; } = string.Empty;

    /// <summary>Si es false, "Ver catalogo" abre Canva en vez del visor integrado.</summary>
    public bool CanvaEmbeddable { get; set; }

    public string? CoverImageUrl { get; set; }

    public string? PdfUrl { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
