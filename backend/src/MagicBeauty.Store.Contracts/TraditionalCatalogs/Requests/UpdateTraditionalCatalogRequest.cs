namespace MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;

/// <summary>La portada y el PDF no viajan aqui: solo cambian por sus endpoints de archivo.</summary>
public sealed class UpdateTraditionalCatalogRequest
{
    public string Name { get; set; } = string.Empty;

    public string CanvaUrl { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
