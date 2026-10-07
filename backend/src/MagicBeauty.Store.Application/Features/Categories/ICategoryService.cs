using MagicBeauty.Store.Contracts.Categories.Requests;
using MagicBeauty.Store.Contracts.Categories.Responses;

namespace MagicBeauty.Store.Application.Features.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<CategoryTreeDto>> GetTreeAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<CategoryMenuDto>> GetMenuAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<CategoryTileDto>> GetHomeTilesAsync(CancellationToken cancellationToken);

    Task<CategoryDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(int id, CancellationToken cancellationToken);
}