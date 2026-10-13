using MagicBeauty.Store.Application.Features.Sitemap;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IProductRepository
{
    Task<IReadOnlyList<Product>> GetAllAsync(
        int? brandId,
        int? categoryId,
        bool? isActive,
        bool? hasCategories,
        string? search,
        CancellationToken cancellationToken);

    /// <summary>Referencia y fecha de los productos activos, sin cargar su grafo: para el sitemap.</summary>
    Task<IReadOnlyList<ProductSitemapEntry>> GetActiveSitemapEntriesAsync(CancellationToken cancellationToken);

    /// <summary>Categorias que tienen asignado directamente al menos un producto activo.</summary>
    Task<IReadOnlyList<int>> GetCategoryIdsWithActiveProductsAsync(CancellationToken cancellationToken);

    /// <summary>Grafo completo y sin seguimiento, para las lecturas de detalle.</summary>
    Task<Product?> GetDetailByIdAsync(int id, CancellationToken cancellationToken);

    Task<Product?> GetDetailByReferenceAsync(string reference, CancellationToken cancellationToken);

    /// <summary>Entidad con seguimiento, para las escrituras.</summary>
    Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<bool> ExistsByReferenceAsync(string reference, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductCategory>> GetCategoryLinksAsync(int productId, CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> GetExistingIdsAsync(IEnumerable<int> ids, CancellationToken cancellationToken);

    /// <summary>De los productos indicados, los que ya pertenecen a la categoria.</summary>
    Task<IReadOnlyList<int>> GetIdsInCategoryAsync(
        int categoryId,
        IEnumerable<int> productIds,
        CancellationToken cancellationToken);

    Task AddCategoryLinksAsync(IEnumerable<ProductCategory> links, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductPrice>> GetPricesAsync(int productId, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductVariant>> GetVariantsAsync(int productId, CancellationToken cancellationToken);

    Task<ProductVariant?> GetVariantByIdAsync(int variantId, CancellationToken cancellationToken);

    Task<int> CountActiveVariantsAsync(int productId, CancellationToken cancellationToken);

    Task<IReadOnlyList<InventoryMovement>> GetMovementsAsync(int variantId, CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductImage>> GetImagesAsync(int productId, CancellationToken cancellationToken);

    Task<ProductImage?> GetImageByIdAsync(int imageId, CancellationToken cancellationToken);

    Task AddAsync(Product product, CancellationToken cancellationToken);

    Task AddVariantAsync(ProductVariant variant, CancellationToken cancellationToken);

    Task AddMovementAsync(InventoryMovement movement, CancellationToken cancellationToken);

    Task AddImageAsync(ProductImage image, CancellationToken cancellationToken);

    void RemoveImage(ProductImage image);

    void RemoveCategoryLinks(IEnumerable<ProductCategory> links);

    void RemovePrices(IEnumerable<ProductPrice> prices);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
