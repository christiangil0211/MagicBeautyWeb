using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IPriceTypeRepository
{
    Task<IReadOnlyList<PriceType>> GetAllAsync(CancellationToken cancellationToken);

    Task<PriceType?> GetDefaultAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken);
}
