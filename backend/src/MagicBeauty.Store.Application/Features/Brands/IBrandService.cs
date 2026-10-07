using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;

namespace MagicBeauty.Store.Application.Features.Brands;

public interface IBrandService
{
    Task<IReadOnlyList<BrandDto>> GetAllAsync(CancellationToken cancellationToken);

    Task<BrandDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(int id, UpdateBrandRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(int id, CancellationToken cancellationToken);
}
