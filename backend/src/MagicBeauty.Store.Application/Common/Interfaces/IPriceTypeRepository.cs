using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IPriceTypeRepository
{
    Task<IReadOnlyList<PriceType>> GetAllAsync(CancellationToken cancellationToken);

    Task<PriceType?> GetDefaultAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<int>> GetExistingIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken);

    /// <summary>Tipos activos marcados como visibles para el publico.</summary>
    Task<IReadOnlyList<PriceType>> GetPublicAsync(CancellationToken cancellationToken);

    /// <summary>Tipos activos autorizados para al menos uno de los roles activos indicados.</summary>
    Task<IReadOnlyList<PriceType>> GetForRolesAsync(
        IReadOnlyCollection<string> roleCodes,
        CancellationToken cancellationToken);
}
