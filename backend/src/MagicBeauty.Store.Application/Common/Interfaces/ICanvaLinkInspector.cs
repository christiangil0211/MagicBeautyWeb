namespace MagicBeauty.Store.Application.Common.Interfaces;

/// <summary>
/// Consultas a Canva al guardar un catalogo. Lo implementa infraestructura, que
/// es la que sale a internet, y solo habla con dominios de Canva.
/// </summary>
public interface ICanvaLinkInspector
{
    /// <summary>
    /// Destino de un enlace corto (https://canva.link/...) en canva.com, o null si
    /// no se pudo resolver.
    /// </summary>
    Task<string?> ResolveAsync(Uri shortLink, CancellationToken cancellationToken);

    /// <summary>
    /// Si la URL de insercion se puede mostrar dentro de otra pagina sin iniciar
    /// sesion en Canva. Ante cualquier duda responde false: se abrira en Canva.
    /// </summary>
    Task<bool> IsEmbeddableAsync(Uri embedUrl, CancellationToken cancellationToken);
}
