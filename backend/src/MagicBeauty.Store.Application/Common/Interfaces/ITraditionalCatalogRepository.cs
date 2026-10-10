using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface ITraditionalCatalogRepository
{
    Task<IReadOnlyList<TraditionalCatalog>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<TraditionalCatalog>> GetActiveAsync(CancellationToken cancellationToken);

    Task<TraditionalCatalog?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task AddAsync(TraditionalCatalog catalog, CancellationToken cancellationToken);

    void Delete(TraditionalCatalog catalog);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
