using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

/// <summary>Qué productos lista la gestión de una marca.</summary>
public enum BrandProductScope
{
    /// <summary>Todos los productos (para agregar a la marca).</summary>
    All,

    /// <summary>Solo los que no tienen marca (BrandId NULL).</summary>
    WithoutBrand,

    /// <summary>Solo los de la marca que se está gestionando.</summary>
    InBrand
}

public interface IBrandRepository
{
    /// <summary>Sin seguimiento, ordenadas por orden y nombre. La búsqueda ignora tildes y mayúsculas.</summary>
    Task<IReadOnlyList<Brand>> GetAllAsync(string? search, CancellationToken cancellationToken);

    /// <summary>Con seguimiento, para escribir.</summary>
    Task<Brand?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<Brand?> GetBySlugAsync(string slug, CancellationToken cancellationToken);

    Task<bool> IsSlugTakenAsync(string slug, int? excludedId, CancellationToken cancellationToken);

    /// <summary>Cuántos productos (activos e inactivos) tiene cada marca.</summary>
    Task<IReadOnlyDictionary<int, int>> GetProductCountsAsync(CancellationToken cancellationToken);

    Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken);

    /// <summary>Productos para la gestión de una marca, paginados, con su marca actual.</summary>
    Task<(IReadOnlyList<Product> Items, int Total)> GetProductsPageAsync(
        int brandId,
        BrandProductScope scope,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>Con seguimiento y con su marca: para asignar, mover o quitar.</summary>
    Task<IReadOnlyList<Product>> GetProductsByIdsAsync(IReadOnlyCollection<int> productIds, CancellationToken cancellationToken);

    Task AddAsync(Brand brand, CancellationToken cancellationToken);

    void Delete(Brand brand);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
