using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class PriceTypeRepository(MagicBeautyDbContext dbContext) : IPriceTypeRepository
{
    public async Task<IReadOnlyList<PriceType>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await dbContext.PriceTypes
            .AsNoTracking()
            .OrderByDescending(priceType => priceType.IsDefault)
            .ThenBy(priceType => priceType.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task<PriceType?> GetDefaultAsync(CancellationToken cancellationToken)
    {
        return await dbContext.PriceTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(priceType => priceType.IsDefault && priceType.IsActive, cancellationToken);
    }

    public async Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken)
    {
        var requested = ids.Distinct().ToList();

        return await dbContext.PriceTypes
            .AsNoTracking()
            .Where(priceType => requested.Contains(priceType.Id))
            .Select(priceType => priceType.Id)
            .ToListAsync(cancellationToken);
    }
}
