using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Brands;

public sealed class BrandService(IBrandRepository brandRepository) : IBrandService
{
    public async Task<IReadOnlyList<BrandDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var brands = await brandRepository.GetAllAsync(cancellationToken);

        return brands.Select(MapToDto).ToList();
    }

    public async Task<BrandDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await brandRepository.GetByIdAsync(id, cancellationToken);

        if (brand is null)
        {
            throw new KeyNotFoundException("La marca no existe.");
        }

        return MapToDto(brand);
    }

    public async Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken cancellationToken)
    {
        var name = NormalizeName(request.Name);

        await ValidateNameIsAvailableAsync(name, null, cancellationToken);

        var now = DateTime.UtcNow;

        var brand = new Brand
        {
            Name = name,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        await brandRepository.AddAsync(brand, cancellationToken);
        await brandRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(brand);
    }

    public async Task UpdateAsync(int id, UpdateBrandRequest request, CancellationToken cancellationToken)
    {
        var brand = await brandRepository.GetByIdAsync(id, cancellationToken);

        if (brand is null)
        {
            throw new KeyNotFoundException("La marca no existe.");
        }

        var name = NormalizeName(request.Name);

        await ValidateNameIsAvailableAsync(name, id, cancellationToken);

        brand.Name = name;
        brand.IsActive = request.IsActive;
        brand.UpdatedAt = DateTime.UtcNow;

        await brandRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await brandRepository.GetByIdAsync(id, cancellationToken);

        if (brand is null)
        {
            throw new KeyNotFoundException("La marca no existe.");
        }

        // La relacion Product -> Brand es Restrict: sin este guard SQL Server lanzaria
        // DbUpdateException y el cliente recibiria un 500 en vez de un error de negocio.
        if (await brandRepository.HasProductsAsync(id, cancellationToken))
        {
            throw new InvalidOperationException("No se puede eliminar una marca con productos asociados.");
        }

        brandRepository.Delete(brand);
        await brandRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidateNameIsAvailableAsync(
        string name,
        int? excludedId,
        CancellationToken cancellationToken)
    {
        if (await brandRepository.ExistsByNameAsync(name, excludedId, cancellationToken))
        {
            throw new InvalidOperationException("Ya existe una marca con el mismo nombre.");
        }
    }

    private static string NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("El nombre de la marca es obligatorio.");
        }

        return name.Trim();
    }

    private static BrandDto MapToDto(Brand brand)
    {
        return new BrandDto
        {
            Id = brand.Id,
            Name = brand.Name,
            IsActive = brand.IsActive,
            CreatedAt = brand.CreatedAt,
            UpdatedAt = brand.UpdatedAt
        };
    }
}
