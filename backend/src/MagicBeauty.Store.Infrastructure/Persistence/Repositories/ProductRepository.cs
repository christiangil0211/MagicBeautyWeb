using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class ProductRepository(MagicBeautyDbContext dbContext) : IProductRepository
{
    /// <summary>Insensible a mayusculas y a tildes, solo para comparar en la busqueda.</summary>
    private const string SearchCollation = "Latin1_General_CI_AI";

    /// <summary>Evita consultas desmedidas si alguien pega un texto largo.</summary>
    private const int MaxSearchTerms = 6;

    private static IEnumerable<string> SplitSearchTerms(string? search)
    {
        return string.IsNullOrWhiteSpace(search)
            ? []
            : search
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(MaxSearchTerms);
    }

    public async Task<IReadOnlyList<Product>> GetAllAsync(
        int? brandId,
        int? categoryId,
        bool? isActive,
        string? search,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Products
            .AsNoTracking()
            .Include(product => product.Brand)
            .Include(product => product.Variants)
            .Include(product => product.Images)
            .Include(product => product.ProductCategories)
                .ThenInclude(link => link.Category)
            .Include(product => product.Prices)
                .ThenInclude(price => price.PriceType)
            .AsQueryable();

        if (brandId.HasValue)
        {
            query = query.Where(product => product.BrandId == brandId.Value);
        }

        if (categoryId.HasValue)
        {
            // Read only hierarchy edges once; walk every descendant without a query per level.
            var hierarchy = await dbContext.Categories
                .AsNoTracking()
                .Select(category => new { category.Id, category.ParentCategoryId })
                .ToListAsync(cancellationToken);
            var childrenByParent = hierarchy
                .Where(category => category.ParentCategoryId.HasValue)
                .ToLookup(category => category.ParentCategoryId!.Value, category => category.Id);
            var categoryIds = new HashSet<int> { categoryId.Value };
            var pending = new Stack<int>();
            pending.Push(categoryId.Value);
            while (pending.TryPop(out var parentId))
            {
                cancellationToken.ThrowIfCancellationRequested();
                foreach (var childId in childrenByParent[parentId])
                    if (categoryIds.Add(childId)) pending.Push(childId);
            }

            query = query.Where(product =>
                product.ProductCategories.Any(link => categoryIds.Contains(link.CategoryId)));
        }

        if (isActive.HasValue)
        {
            query = query.Where(product => product.IsActive == isActive.Value);
        }

        // Cada palabra debe aparecer en el nombre, la referencia o la marca, sin
        // importar mayusculas ni tildes: "rimel milagros" encuentra "RÍMEL ... MILAGROS".
        foreach (var term in SplitSearchTerms(search))
        {
            query = query.Where(product =>
                EF.Functions.Collate(product.Name, SearchCollation).Contains(term) ||
                EF.Functions.Collate(product.Reference, SearchCollation).Contains(term) ||
                (product.Brand != null &&
                    EF.Functions.Collate(product.Brand.Name, SearchCollation).Contains(term)));
        }

        return await query
            .OrderBy(product => product.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<Product?> GetDetailByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await BuildDetailQuery()
            .FirstOrDefaultAsync(product => product.Id == id, cancellationToken);
    }

    public async Task<Product?> GetDetailByReferenceAsync(
        string reference,
        CancellationToken cancellationToken)
    {
        return await BuildDetailQuery()
            .FirstOrDefaultAsync(product => product.Reference == reference, cancellationToken);
    }

    public async Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .FirstOrDefaultAsync(product => product.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsByReferenceAsync(string reference, CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .AnyAsync(product => product.Reference == reference, cancellationToken);
    }

    public async Task<IReadOnlyList<ProductCategory>> GetCategoryLinksAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ProductCategories
            .Where(link => link.ProductId == productId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductPrice>> GetPricesAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ProductPrices
            .Where(price => price.ProductId == productId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductVariant>> GetVariantsAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ProductVariants
            .AsNoTracking()
            .Where(variant => variant.ProductId == productId)
            .OrderBy(variant => variant.DisplayOrder)
            .ThenBy(variant => variant.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<ProductVariant?> GetVariantByIdAsync(
        int variantId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ProductVariants
            .FirstOrDefaultAsync(variant => variant.Id == variantId, cancellationToken);
    }

    public async Task<int> CountActiveVariantsAsync(int productId, CancellationToken cancellationToken)
    {
        return await dbContext.ProductVariants
            .CountAsync(variant => variant.ProductId == productId && variant.IsActive, cancellationToken);
    }

    public async Task<IReadOnlyList<InventoryMovement>> GetMovementsAsync(
        int variantId,
        CancellationToken cancellationToken)
    {
        return await dbContext.InventoryMovements
            .AsNoTracking()
            .Where(movement => movement.ProductVariantId == variantId)
            .OrderByDescending(movement => movement.CreatedAt)
            .ThenByDescending(movement => movement.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductImage>> GetImagesAsync(
        int productId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ProductImages
            .Where(image => image.ProductId == productId)
            .OrderBy(image => image.DisplayOrder)
            .ToListAsync(cancellationToken);
    }

    public async Task<ProductImage?> GetImageByIdAsync(int imageId, CancellationToken cancellationToken)
    {
        return await dbContext.ProductImages
            .FirstOrDefaultAsync(image => image.Id == imageId, cancellationToken);
    }

    public async Task AddAsync(Product product, CancellationToken cancellationToken)
    {
        await dbContext.Products.AddAsync(product, cancellationToken);
    }

    public async Task AddVariantAsync(ProductVariant variant, CancellationToken cancellationToken)
    {
        await dbContext.ProductVariants.AddAsync(variant, cancellationToken);
    }

    public async Task AddMovementAsync(InventoryMovement movement, CancellationToken cancellationToken)
    {
        await dbContext.InventoryMovements.AddAsync(movement, cancellationToken);
    }

    public async Task AddImageAsync(ProductImage image, CancellationToken cancellationToken)
    {
        await dbContext.ProductImages.AddAsync(image, cancellationToken);
    }

    public void RemoveImage(ProductImage image)
    {
        dbContext.ProductImages.Remove(image);
    }

    public void RemoveCategoryLinks(IEnumerable<ProductCategory> links)
    {
        dbContext.ProductCategories.RemoveRange(links);
    }

    public void RemovePrices(IEnumerable<ProductPrice> prices)
    {
        dbContext.ProductPrices.RemoveRange(prices);
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Se traduce aqui para que EF Core no se filtre a Application y para que
            // el choque de inventario salga como error de negocio y no como 500.
            throw new InvalidOperationException(
                "Otra operacion modifico estas existencias mientras guardabas. Vuelve a intentarlo.");
        }
    }

    private IQueryable<Product> BuildDetailQuery()
    {
        return dbContext.Products
            .AsNoTracking()
            .Include(product => product.Brand)
            .Include(product => product.ProductCategories)
                .ThenInclude(link => link.Category)
            .Include(product => product.Prices)
                .ThenInclude(price => price.PriceType)
            .Include(product => product.Variants)
            .Include(product => product.Images);
    }
}
