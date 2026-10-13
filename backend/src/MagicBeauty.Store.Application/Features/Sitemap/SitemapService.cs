using System.Text;
using System.Xml.Linq;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Contracts.Categories.Responses;

namespace MagicBeauty.Store.Application.Features.Sitemap;

public sealed class SitemapService(
    IProductRepository productRepository,
    ICategoryService categoryService) : ISitemapService
{
    private static readonly XNamespace Namespace = "http://www.sitemaps.org/schemas/sitemap/0.9";

    /// <summary>
    /// Paginas fijas del portal. El pedido, las busquedas y el administrador no
    /// se listan: son privadas o estan marcadas como noindex.
    /// </summary>
    private static readonly string[] PortalPaths = ["/", "/catalogo", "/catalogos"];

    public async Task<string> BuildXmlAsync(string siteUrl, CancellationToken cancellationToken)
    {
        var baseUrl = siteUrl.TrimEnd('/');

        // Arbol publico: solo categorias activas cuyas antecesoras tambien lo estan.
        var categories = await categoryService.GetCatalogTreeAsync(cancellationToken);

        // Solo productos activos: uno desactivado no existe para la tienda.
        var products = await productRepository.GetActiveSitemapEntriesAsync(cancellationToken);

        // Una categoria sin productos activos (ni en sus subcategorias) seria una
        // pagina vacia: no se le ofrece a los buscadores hasta que tenga contenido.
        var populated = (await productRepository.GetCategoryIdsWithActiveProductsAsync(cancellationToken))
            .ToHashSet();

        var urls = PortalPaths
            .Select(path => Url(baseUrl + path, null))
            .Concat(Flatten(categories)
                .Where(category => HasProducts(category, populated))
                .Select(category => Url(baseUrl + "/catalogo/categoria/" + Uri.EscapeDataString(category.Slug), null)))
            .Concat(products
                .Select(product => Url(
                    baseUrl + "/catalogo/" + Uri.EscapeDataString(product.Reference),
                    product.UpdatedAt)));

        var document = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement(Namespace + "urlset", urls));

        using var writer = new Utf8StringWriter();
        document.Save(writer);

        return writer.ToString();
    }

    private static XElement Url(string location, DateTime? lastModified)
    {
        var url = new XElement(Namespace + "url", new XElement(Namespace + "loc", location));

        if (lastModified.HasValue)
        {
            url.Add(new XElement(Namespace + "lastmod", lastModified.Value.ToString("yyyy-MM-dd")));
        }

        return url;
    }

    private static bool HasProducts(CategoryMenuDto category, HashSet<int> populated)
    {
        return populated.Contains(category.Id) || category.Children.Any(child => HasProducts(child, populated));
    }

    private static IEnumerable<CategoryMenuDto> Flatten(IEnumerable<CategoryMenuDto> categories)
    {
        foreach (var category in categories)
        {
            yield return category;

            foreach (var child in Flatten(category.Children))
            {
                yield return child;
            }
        }
    }

    /// <summary>StringWriter declara UTF-16; el sitemap se sirve en UTF-8.</summary>
    private sealed class Utf8StringWriter : StringWriter
    {
        public override Encoding Encoding => Encoding.UTF8;
    }
}
