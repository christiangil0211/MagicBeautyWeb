using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;

namespace MagicBeauty.Store.Application.Features.Brands;

public interface IBrandService
{
    Task<IReadOnlyList<BrandDto>> GetAllAsync(string? search, CancellationToken cancellationToken);

    Task<BrandDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken cancellationToken);

    Task<BrandDto> UpdateAsync(int id, UpdateBrandRequest request, CancellationToken cancellationToken);

    /// <summary>Solo si no tiene productos (si tiene, se desactiva). Borra también su logo.</summary>
    Task DeleteAsync(int id, CancellationToken cancellationToken);

    /// <summary>Un solo logo por marca: reemplazarlo borra el anterior del almacenamiento.</summary>
    Task<BrandDto> UploadLogoAsync(int id, Stream content, long length, CancellationToken cancellationToken);

    Task<BrandDto> DeleteLogoAsync(int id, CancellationToken cancellationToken);

    Task<BrandProductsPageDto> GetProductsAsync(
        int id,
        BrandProductScope scope,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>
    /// Asigna la marca a los productos. Si alguno ya tiene otra marca y no se pidió
    /// moverlo, lanza <see cref="BrandAssignmentConflictException"/> sin cambiar nada.
    /// </summary>
    Task<BrandAssignmentResultDto> AssignProductsAsync(int id, AssignBrandProductsRequest request, CancellationToken cancellationToken);

    /// <summary>Deja los productos sin marca (BrandId NULL).</summary>
    Task<BrandAssignmentResultDto> RemoveProductsAsync(RemoveBrandProductsRequest request, CancellationToken cancellationToken);
}

/// <summary>Productos que ya tienen otra marca: se informan para pedir confirmación.</summary>
public sealed class BrandAssignmentConflictException(IReadOnlyList<BrandAssignmentConflictDto> conflicts)
    : InvalidOperationException("Algunos productos ya tienen otra marca. Confirma para moverlos.")
{
    public IReadOnlyList<BrandAssignmentConflictDto> Conflicts { get; } = conflicts;
}
