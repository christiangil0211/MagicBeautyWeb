namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Catalogo tradicional disenado en Canva: se presenta con el visor de Canva y se
/// descarga en PDF. La portada y el PDF se suben desde la administracion.
/// </summary>
public sealed class TraditionalCatalog
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>URL de insercion de Canva ya validada y normalizada (.../view?embed).</summary>
    public string CanvaEmbedUrl { get; set; } = string.Empty;

    /// <summary>Enlace tal como se compartio desde Canva (canva.link, ver o editar): "Abrir en Canva".</summary>
    public string CanvaShareUrl { get; set; } = string.Empty;

    /// <summary>
    /// Canva permite mostrar la insercion dentro de la tienda. Si no, el catalogo se
    /// abre directamente en Canva. Se comprueba al guardar.
    /// </summary>
    public bool CanvaEmbeddable { get; set; }

    public string? CoverImageUrl { get; set; }

    public string? PdfUrl { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
