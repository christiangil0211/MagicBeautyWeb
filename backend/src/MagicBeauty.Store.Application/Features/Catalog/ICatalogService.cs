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
}
