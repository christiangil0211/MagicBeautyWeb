namespace MagicBeauty.Store.Integrations.Alegra.Persistence;

/// <summary>
/// Asociacion entre un producto de la tienda y su item de Alegra. El id de Alegra
/// no cambia: una vez asociado, el producto se cruza por id aunque su referencia
/// cambie en Alegra. Sin llave foranea a la tabla de productos, a proposito: la
/// integracion no depende del esquema de la tienda (los vinculos huerfanos se limpian solos).
/// </summary>
public sealed class AlegraProductLink
{
    public int ProductId { get; set; }

    public string AlegraItemId { get; set; } = string.Empty;

    /// <summary>
    /// Huella de la ultima descripcion traida de Alegra. La descripcion no viene en el
    /// listado de la tienda: con esto se sabe si cambio sin cargar el detalle.
    /// </summary>
    public string? DescriptionHash { get; set; }

    public DateTime LinkedAt { get; set; }

    public DateTime LastSyncedAt { get; set; }
}
