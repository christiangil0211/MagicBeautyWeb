using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IHomeBannerRepository
{
    /// <summary>Todos, con seguimiento, en el orden del carrusel (orden y luego Id).</summary>
    Task<IReadOnlyList<Banner>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Sin seguimiento: activos, con imagen y vigentes en <paramref name="today"/>, en orden.</summary>
    Task<IReadOnlyList<Banner>> GetVisibleAsync(DateOnly today, CancellationToken cancellationToken);

    /// <summary>Con seguimiento, para escribir.</summary>
    Task<Banner?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<int> GetMaxSortOrderAsync(CancellationToken cancellationToken);

    Task AddAsync(Banner banner, CancellationToken cancellationToken);

    void Delete(Banner banner);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
