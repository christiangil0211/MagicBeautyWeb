using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class BrandRepository(MagicBeautyDbContext dbContext) : IBrandRepository
{
    /// <summary>Insensible a mayúsculas y a tildes, como la búsqueda de productos.</summary>
    private const string SearchCollation = "Latin1_General_CI_AI";

    public async Task<IReadOnlyList<Brand>> GetAllAsync(string? search, CancellationToken cancellationToken)
    {
        var brands = await dbContext.Brands
            .AsNoTracking()
            .OrderBy(brand => brand.SortOrder)
            .ThenBy(brand => brand.Name)
            .ToListAsync(cancellationToken);

        // Son pocas (decenas): se filtran en memoria con la misma clave que detecta
        // duplicados, así "purpure" encuentra "PÚRPURE".
        var key = Slugs.NameKey(search);

        return key.Length == 0
            ? brands
            : brands.Where(brand => Slugs.NameKey(brand.Name).Contains(key, StringComparison.Ordinal)).ToList();
    }

    public async Task<Brand?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .FirstOrDefaultAsync(brand => brand.Id == id, cancellationToken);
    }

    public async Task<Brand?> GetBySlugAsync(string slug, CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .AsNoTracking()
            .FirstOrDefaultAsync(brand => brand.Slug == slug, cancellationToken);
    }

    public async Task<bool> IsSlugTakenAsync(string slug, int? excludedId, CancellationToken cancellationToken)
    {
        return await dbContext.Brands
            .AnyAsync(brand => brand.Slug == slug && (!excludedId.HasValue || brand.Id != excludedId.Value), cancellationToken);
    }

    public async Task<IReadOnlyDictionary<int, int>> GetProductCountsAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .AsNoTracking()
            .Where(product => product.BrandId != null)
            .GroupBy(product => product.BrandId!.Value)
            .Select(group => new { BrandId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.BrandId, item => item.Count, cancellationToken);
    }

    public async Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .AnyAsync(product => product.BrandId == id, cancellationToken);
    }

    public async Task<(IReadOnlyList<Product> Items, int Total)> GetProductsPageAsync(
        int brandId,
        BrandProductScope scope,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Products
            .AsNoTracking()
            .Include(product => product.Brand)
            .Include(product => product.Images)
            .AsQueryable();

        query = scope switch
        {
            BrandProductScope.WithoutBrand => query.Where(product => product.BrandId == null),
            BrandProductScope.InBrand => query.Where(product => product.BrandId == brandId),
            _ => query
        };

        // Cada palabra en el nombre o la referencia, sin importar tildes ni mayúsculas.
        foreach (var term in (search ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(6))
        {
            query = query.Where(product =>
                EF.Functions.Collate(product.Name, SearchCollation).Contains(term) ||
                EF.Functions.Collate(product.Reference, SearchCollation).Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            // Los que no tienen marca primero: son los que suelen faltar por asignar.
            .OrderBy(product => product.BrandId == null ? 0 : 1)
            .ThenBy(product => product.Name)
            .ThenBy(product => product.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<IReadOnlyList<Product>> GetProductsByIdsAsync(
        IReadOnlyCollection<int> productIds,
        CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .Include(product => product.Brand)
            .Where(product => productIds.Contains(product.Id))
            .ToListAsync(cancellationToken);
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
