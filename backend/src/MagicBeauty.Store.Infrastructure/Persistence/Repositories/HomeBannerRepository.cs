using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

/// <summary>Usa Set&lt;Banner&gt;() en vez de una propiedad del contexto: la tabla se descubre por su configuración.</summary>
public sealed class HomeBannerRepository(MagicBeautyDbContext context) : IHomeBannerRepository
{
    private DbSet<Banner> Banners => context.Set<Banner>();

    public async Task<IReadOnlyList<Banner>> GetAllAsync(CancellationToken cancellationToken) =>
        await Banners
            .OrderBy(banner => banner.SortOrder)
            .ThenBy(banner => banner.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Banner>> GetVisibleAsync(DateOnly today, CancellationToken cancellationToken) =>
        await Banners
            .AsNoTracking()
            .Where(banner => banner.IsActive
                && banner.ImageUrl != null
                && (banner.StartsOn == null || banner.StartsOn <= today)
                && (banner.EndsOn == null || banner.EndsOn >= today))
            .OrderBy(banner => banner.SortOrder)
            .ThenBy(banner => banner.Id)
            .ToListAsync(cancellationToken);

    public Task<Banner?> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        Banners.FirstOrDefaultAsync(banner => banner.Id == id, cancellationToken);

    public async Task<int> GetMaxSortOrderAsync(CancellationToken cancellationToken) =>
        await Banners.MaxAsync(banner => (int?)banner.SortOrder, cancellationToken) ?? 0;

    public async Task AddAsync(Banner banner, CancellationToken cancellationToken) =>
        await Banners.AddAsync(banner, cancellationToken);

    public void Delete(Banner banner) => Banners.Remove(banner);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
