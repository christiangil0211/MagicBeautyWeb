using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class BrandRepository(MagicBeautyDbContext dbContext) : IBrandRepository
{
    public async Task<IReadOnlyList<Brand>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .AsNoTracking()
            .OrderBy(brand => brand.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<Brand?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .FirstOrDefaultAsync(brand => brand.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsByNameAsync(string name, int? excludedId, CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .AnyAsync(brand =>
                brand.Name == name &&
                (!excludedId.HasValue || brand.Id != excludedId.Value),
                cancellationToken);
    }

    public async Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .AnyAsync(product => product.BrandId == id, cancellationToken);
    }

    public async Task AddAsync(Brand brand, CancellationToken cancellationToken)
    {
        await dbContext.Brands.AddAsync(brand, cancellationToken);
    }

    public void Delete(Brand brand)
    {
        dbContext.Brands.Remove(brand);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
