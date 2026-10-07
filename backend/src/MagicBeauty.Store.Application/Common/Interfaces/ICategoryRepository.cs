using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface ICategoryRepository
{
    Task<IReadOnlyList<Category>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Category>> GetAllForTreeAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Category>> GetForMenuAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<Category>> GetFeaturedForHomeAsync(CancellationToken cancellationToken);

    Task<Category?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(int id, CancellationToken cancellationToken);

    Task<bool> ExistsBySlugAsync(string slug, int? excludedId, CancellationToken cancellationToken);

    Task<bool> HasChildrenAsync(int id, CancellationToken cancellationToken);

    Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken);

    Task AddAsync(Category category, CancellationToken cancellationToken);

    void Delete(Category category);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}