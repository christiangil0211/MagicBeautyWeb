using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Contracts.Products.Responses;

namespace MagicBeauty.Store.Application.Features.Products;

public interface IProductService
{
    Task<IReadOnlyList<ProductListItemDto>> GetAllAsync(
        int? brandId,
        int? categoryId,
        bool? isActive,
        string? search,
        CancellationToken cancellationToken);

    Task<ProductDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<ProductDto> GetByReferenceAsync(string reference, CancellationToken cancellationToken);

    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(int id, UpdateProductRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(int id, CancellationToken cancellationToken);

    Task SetCategoriesAsync(int id, SetProductCategoriesRequest request, CancellationToken cancellationToken);

    Task SetPricesAsync(int id, SetProductPricesRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductVariantDto>> GetVariantsAsync(int productId, CancellationToken cancellationToken);

    Task<ProductVariantDto> AddVariantAsync(
        int productId,
        CreateProductVariantRequest request,
        CancellationToken cancellationToken);

    Task UpdateVariantAsync(
        int variantId,
        UpdateProductVariantRequest request,
        CancellationToken cancellationToken);

    Task DeleteVariantAsync(int variantId, CancellationToken cancellationToken);

    Task<ProductVariantDto> AdjustInventoryAsync(
        int variantId,
        AdjustInventoryRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<InventoryMovementDto>> GetMovementsAsync(
        int variantId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductImageDto>> GetImagesAsync(int productId, CancellationToken cancellationToken);

    Task<ProductImageDto> AddImageAsync(
        int productId,
        CreateProductImageRequest request,
        CancellationToken cancellationToken);

    Task UpdateImageAsync(
        int imageId,
        UpdateProductImageRequest request,
        CancellationToken cancellationToken);

    /// <summary>Sube el archivo al almacenamiento y lo registra como imagen del producto.</summary>
    Task<ProductImageDto> UploadImageAsync(
        int productId,
        ProductImageUpload upload,
        CancellationToken cancellationToken);

    Task DeleteImageAsync(int imageId, CancellationToken cancellationToken);
}
