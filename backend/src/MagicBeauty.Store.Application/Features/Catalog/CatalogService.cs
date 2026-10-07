using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Contracts.Catalog.Responses;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Catalog;

/// <summary>
/// Cara publica del catalogo. Nunca expone productos desactivados, la variante
/// interna ni precios que la audiencia no tenga autorizados: el filtrado ocurre
/// aqui, antes de serializar, y no en el navegador.
/// </summary>
public sealed class CatalogService(
    IProductRepository productRepository,
    IPriceVisibilityPolicy priceVisibilityPolicy,
    IPriceAudienceProvider priceAudienceProvider) : ICatalogService
{
    public async Task<IReadOnlyList<CatalogProductListItemDto>> GetProductsAsync(
        int? brandId,
        int? categoryId,
        string? search,
        CancellationToken cancellationToken)
    {
        var visiblePriceTypes = await GetVisiblePriceTypesAsync(cancellationToken);

        var products = await productRepository.GetAllAsync(
            brandId,
            categoryId,
            isActive: true,
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            cancellationToken);

        return products
            .Select(product => new CatalogProductListItemDto
            {
                Id = product.Id,
                Reference = product.Reference,
                Name = product.Name,
                BrandName = product.Brand?.Name ?? string.Empty,
                HasVariants = product.HasVariants,
                AvailableQuantity = product.Variants
                    .Where(variant => variant.IsActive)
                    .Sum(variant => variant.Quantity),
                MainImageUrl = product.Images
                    .Where(image => image.IsActive && image.IsMain && image.ProductVariantId is null)
                    .Select(image => image.Url)
                    .FirstOrDefault(),
                Prices = MapVisiblePrices(product, visiblePriceTypes)
            })
            .ToList();
    }

    public async Task<ProductDetailDto> GetProductDetailAsync(
        string reference,
        CancellationToken cancellationToken)
    {
        // En la tienda una referencia mal escrita es simplemente un producto que no existe.
        var normalized = reference?.Trim().ToUpperInvariant() ?? string.Empty;

        var product = string.IsNullOrEmpty(normalized)
            ? null
            : await productRepository.GetDetailByReferenceAsync(normalized, cancellationToken);

        // Un producto desactivado no existe para la tienda.
        if (product is null || !product.IsActive)
        {
            throw new KeyNotFoundException("El producto no existe.");
        }

        var visiblePriceTypes = await GetVisiblePriceTypesAsync(cancellationToken);

        var activeVariants = product.Variants
            .Where(variant => variant.IsActive)
            .OrderBy(variant => variant.DisplayOrder)
            .ThenBy(variant => variant.Name)
            .ToList();

        return new ProductDetailDto
        {
            Id = product.Id,
            Reference = product.Reference,
            Name = product.Name,
            Description = product.Description,
            BrandName = product.Brand?.Name ?? string.Empty,
            Prices = MapVisiblePrices(product, visiblePriceTypes),
            HasVariants = product.HasVariants,
            AvailableQuantity = activeVariants.Sum(variant => variant.Quantity),
            Categories = product.ProductCategories
                .Where(link => link.Category is not null)
                .Select(link => new ProductDetailCategoryDto
                {
                    Id = link.CategoryId,
                    Name = link.Category!.Name,
                    Slug = link.Category.Slug
                })
                .OrderBy(category => category.Name)
                .ToList(),
            Images = product.Images
                .Where(image => image.IsActive)
                .OrderByDescending(image => image.IsMain)
                .ThenBy(image => image.DisplayOrder)
                .Select(image => new ProductDetailImageDto
                {
                    Id = image.Id,
                    ProductVariantId = image.ProductVariantId,
                    Url = image.Url,
                    AltText = image.AltText,
                    DisplayOrder = image.DisplayOrder,
                    IsMain = image.IsMain
                })
                .ToList(),
            // La variante interna nunca se expone: solo existe para el inventario.
            Variants = product.HasVariants
                ? activeVariants
                    .Where(variant => !variant.IsDefault)
                    .Select(variant => new ProductDetailVariantDto
                    {
                        Id = variant.Id,
                        Name = variant.Name,
                        Code = variant.Code,
                        ColorHex = variant.ColorHex,
                        Quantity = variant.Quantity,
                        DisplayOrder = variant.DisplayOrder
                    })
                    .ToList()
                : []
        };
    }

    private Task<IReadOnlyList<PriceType>> GetVisiblePriceTypesAsync(CancellationToken cancellationToken)
    {
        return priceVisibilityPolicy.GetVisiblePriceTypesAsync(
            priceAudienceProvider.GetCurrent(),
            cancellationToken);
    }

    /// <summary>
    /// Cruza los precios del producto con los tipos visibles. El orden lo da la
    /// politica, de modo que todas las pantallas presentan los precios igual.
    /// </summary>
    private static List<CatalogPriceDto> MapVisiblePrices(
        Product product,
        IReadOnlyList<PriceType> visiblePriceTypes)
    {
        var amounts = product.Prices
            .Where(price => price.IsActive)
            .ToDictionary(price => price.PriceTypeId, price => price.Amount);

        return visiblePriceTypes
            .Where(priceType => amounts.ContainsKey(priceType.Id))
            .Select(priceType => new CatalogPriceDto
            {
                PriceTypeCode = priceType.Code,
                PriceTypeName = priceType.Name,
                Amount = amounts[priceType.Id]
            })
            .ToList();
    }
}
