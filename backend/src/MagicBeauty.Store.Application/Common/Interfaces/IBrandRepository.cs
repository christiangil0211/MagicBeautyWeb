using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IBrandRepository
{
    Task<IReadOnlyList<Brand>> GetAllAsync(CancellationToken cancellationToken);

    Task<Brand?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<bool> ExistsByNameAsync(string name, int? excludedId, CancellationToken cancellationToken);

    Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken);

    Task AddAsync(Brand brand, CancellationToken cancellationToken);

    void Delete(Brand brand);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
