using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class CategoryRepository(MagicBeautyDbContext dbContext) : ICategoryRepository
{
    public async Task<IReadOnlyList<Category>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .Include(category => category.ParentCategory)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Category>> GetAllForTreeAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Category>> GetForMenuAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .Where(category => category.IsActive && category.ShowInNavigation)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Category>> GetFeaturedForHomeAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .Where(category => category.IsActive && category.ShowInHome)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<Category?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .FirstOrDefaultAsync(category => category.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AnyAsync(category => category.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsBySlugAsync(string slug, int? excludedId, CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AnyAsync(category =>
                category.Slug == slug &&
                (!excludedId.HasValue || category.Id != excludedId.Value),
                cancellationToken);
    }

    public async Task<bool> HasChildrenAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AnyAsync(category => category.ParentCategoryId == id, cancellationToken);
    }

    public async Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.ProductCategories
            .AnyAsync(link => link.CategoryId == id, cancellationToken);
    }

    public async Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken)
    {
        var requested = ids.Distinct().ToList();

        return await dbContext.Categories
            .AsNoTracking()
            .Where(category => requested.Contains(category.Id))
            .Select(category => category.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Category category, CancellationToken cancellationToken)
    {
        await dbContext.Categories.AddAsync(category, cancellationToken);
    }

    public void Delete(Category category)
    {
        dbContext.Categories.Remove(category);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}