using MagicBeauty.Store.Contracts.Catalog.Responses;

namespace MagicBeauty.Store.Application.Features.Catalog;

/// <summary>
/// Lecturas de la tienda. Los precios salen filtrados por
/// <see cref="Pricing.IPriceVisibilityPolicy"/> para la audiencia de la peticion.
/// </summary>
public interface ICatalogService
{
    Task<IReadOnlyList<CatalogProductListItemDto>> GetProductsAsync(
        int? brandId,
        int? categoryId,
        string? search,
        CancellationToken cancellationToken);

    Task<ProductDetailDto> GetProductDetailAsync(string reference, CancellationToken cancellationToken);

    /// <summary>
    /// Productos activos de la misma categoria que el de la referencia, sin
    /// incluirlo. La ficha los muestra sin descargar el catalogo completo.
    /// </summary>
    Task<IReadOnlyList<CatalogProductListItemDto>> GetRelatedProductsAsync(
        string reference,
        int limit,
        CancellationToken cancellationToken);
}
