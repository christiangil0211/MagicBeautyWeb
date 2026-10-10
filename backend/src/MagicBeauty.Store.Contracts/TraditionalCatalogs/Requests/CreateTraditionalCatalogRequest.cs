namespace MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;

/// <summary>La portada y el PDF se suben aparte, igual que las imagenes de categoria.</summary>
public sealed class CreateTraditionalCatalogRequest
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Enlace de Canva (ver, compartir o insertar) o el codigo de insercion completo.</summary>
    public string CanvaUrl { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
