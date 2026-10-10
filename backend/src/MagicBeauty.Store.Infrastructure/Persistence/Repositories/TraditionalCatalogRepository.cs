using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class TraditionalCatalogRepository(MagicBeautyDbContext dbContext) : ITraditionalCatalogRepository
{
    public async Task<IReadOnlyList<TraditionalCatalog>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await dbContext.TraditionalCatalogs
            .AsNoTracking()
            .OrderBy(catalog => catalog.DisplayOrder)
            .ThenBy(catalog => catalog.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TraditionalCatalog>> GetActiveAsync(CancellationToken cancellationToken)
    {
        return await dbContext.TraditionalCatalogs
            .AsNoTracking()
            .Where(catalog => catalog.IsActive)
            .OrderBy(catalog => catalog.DisplayOrder)
            .ThenBy(catalog => catalog.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<TraditionalCatalog?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.TraditionalCatalogs
            .FirstOrDefaultAsync(catalog => catalog.Id == id, cancellationToken);
    }

    public async Task AddAsync(TraditionalCatalog catalog, CancellationToken cancellationToken)
    {
        await dbContext.TraditionalCatalogs.AddAsync(catalog, cancellationToken);
    }

    public void Delete(TraditionalCatalog catalog)
    {
        dbContext.TraditionalCatalogs.Remove(catalog);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
