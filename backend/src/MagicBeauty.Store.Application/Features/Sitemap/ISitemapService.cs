namespace MagicBeauty.Store.Application.Features.Sitemap;

/// <summary>
/// Sitemap XML de la tienda publica: paginas del portal, categorias activas y
/// productos activos. Se genera en cada consulta, asi nunca queda desactualizado.
/// </summary>
public interface ISitemapService
{
    /// <param name="siteUrl">Dominio publico de la tienda (Store:PublicUrl).</param>
    Task<string> BuildXmlAsync(string siteUrl, CancellationToken cancellationToken);
}

/// <summary>Lo minimo de un producto para listarlo en el sitemap.</summary>
public sealed record ProductSitemapEntry(string Reference, DateTime UpdatedAt);
