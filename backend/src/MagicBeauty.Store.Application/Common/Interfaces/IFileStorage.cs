namespace MagicBeauty.Store.Application.Common.Interfaces;

/// <summary>
/// Almacenamiento de archivos publicos (imagenes del catalogo). Hoy: disco local en
/// Development o Azure Blob Storage cuando este configurado.
/// </summary>
public interface IFileStorage
{
    /// <summary>Guarda el archivo y devuelve la URL publica con la que se sirve.</summary>
    Task<string> SaveAsync(
        string path,
        Stream content,
        string contentType,
        CancellationToken cancellationToken);

    /// <summary>
    /// Borra el archivo si la URL pertenece a este almacenamiento. Las URLs externas
    /// (cargadas a mano) se ignoran.
    /// </summary>
    Task DeleteByUrlAsync(string url, CancellationToken cancellationToken);
}
