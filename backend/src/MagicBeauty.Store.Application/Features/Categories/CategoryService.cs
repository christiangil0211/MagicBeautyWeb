using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Categories.Requests;
using MagicBeauty.Store.Contracts.Categories.Responses;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Categories;

public sealed class CategoryService(ICategoryRepository categoryRepository) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var categories = await categoryRepository.GetAllAsync(cancellationToken);

        return categories.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<CategoryTreeDto>> GetTreeAsync(CancellationToken cancellationToken)
    {
        var categories = await categoryRepository.GetAllForTreeAsync(cancellationToken);

        var lookup = categories
            .Select(MapToTreeDto)
            .ToDictionary(category => category.Id);

        foreach (var category in lookup.Values)
        {
            if (category.ParentCategoryId.HasValue &&
                lookup.TryGetValue(category.ParentCategoryId.Value, out var parent))
            {
                parent.Children.Add(category);
            }
        }

        return lookup.Values
            .Where(category => category.ParentCategoryId is null)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .ToList();
    }

    public async Task<IReadOnlyList<CategoryMenuDto>> GetMenuAsync(CancellationToken cancellationToken)
    {
        var categories = await categoryRepository.GetForMenuAsync(cancellationToken);

        var childrenByParentId = categories
            .Where(category => category.ParentCategoryId.HasValue)
            .GroupBy(category => category.ParentCategoryId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        // Una rama activa colgada de un padre oculto no se publica: el recorrido parte de las raices.
        List<CategoryMenuDto> BuildBranch(IEnumerable<Category> nodes)
        {
            return nodes
                .Select(node => new CategoryMenuDto
                {
                    Id = node.Id,
                    Name = node.Name,
                    Slug = node.Slug,
                    ImageUrl = Normalize(node.ImageUrl),
                    Children = childrenByParentId.TryGetValue(node.Id, out var children)
                        ? BuildBranch(children)
                        : []
                })
                .ToList();
        }

        return BuildBranch(categories.Where(category => category.ParentCategoryId is null));
    }

    public async Task<IReadOnlyList<CategoryTileDto>> GetHomeTilesAsync(CancellationToken cancellationToken)
    {
        var categories = await categoryRepository.GetFeaturedForHomeAsync(cancellationToken);

        return categories
            .Select(category => new CategoryTileDto
            {
                Id = category.Id,
                Name = category.Name,
                Slug = category.Slug,
                ImageUrl = Normalize(category.HomeImageUrl) ?? Normalize(category.ImageUrl)
            })
            .ToList();
    }

    public async Task<CategoryDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);

        if (category is null)
        {
            throw new KeyNotFoundException("La categoría no existe.");
        }

        return MapToDto(category);
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        await ValidateCreateAsync(request, cancellationToken);

        var now = DateTime.UtcNow;

        var category = new Category
        {
            Name = request.Name.Trim(),
            Description = Normalize(request.Description),
            Slug = request.Slug.Trim().ToLowerInvariant(),
            ParentCategoryId = request.ParentCategoryId,
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            ImageUrl = Normalize(request.ImageUrl),
            HomeImageUrl = Normalize(request.HomeImageUrl),
            IconUrl = Normalize(request.IconUrl),
            ShowInHome = request.ShowInHome,
            ShowInNavigation = request.ShowInNavigation,
            ShowInMegaMenu = request.ShowInMegaMenu,
            CreatedAt = now,
            UpdatedAt = now
        };

        await categoryRepository.AddAsync(category, cancellationToken);
        await categoryRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(category);
    }

    public async Task UpdateAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);

        if (category is null)
        {
            throw new KeyNotFoundException("La categoría no existe.");
        }

        await ValidateUpdateAsync(id, request, cancellationToken);

        category.Name = request.Name.Trim();
        category.Description = Normalize(request.Description);
        category.Slug = request.Slug.Trim().ToLowerInvariant();
        category.ParentCategoryId = request.ParentCategoryId;
        category.DisplayOrder = request.DisplayOrder;
        category.IsActive = request.IsActive;
        category.ImageUrl = Normalize(request.ImageUrl);
        category.HomeImageUrl = Normalize(request.HomeImageUrl);
        category.IconUrl = Normalize(request.IconUrl);
        category.ShowInHome = request.ShowInHome;
        category.ShowInNavigation = request.ShowInNavigation;
        category.ShowInMegaMenu = request.ShowInMegaMenu;
        category.UpdatedAt = DateTime.UtcNow;

        await categoryRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);

        if (category is null)
        {
            throw new KeyNotFoundException("La categoría no existe.");
        }

        if (await categoryRepository.HasChildrenAsync(id, cancellationToken))
        {
            throw new InvalidOperationException("No se puede eliminar una categoría con categorías hijas.");
        }

        if (await categoryRepository.HasProductsAsync(id, cancellationToken))
        {
            throw new InvalidOperationException("No se puede eliminar una categoría con productos asociados.");
        }

        categoryRepository.Delete(category);
        await categoryRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidateCreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        ValidateRequiredFields(request.Name, request.Slug, request.DisplayOrder);

        if (await categoryRepository.ExistsBySlugAsync(request.Slug.Trim().ToLowerInvariant(), null, cancellationToken))
        {
            throw new InvalidOperationException("Ya existe una categoría con el mismo slug.");
        }

        if (request.ParentCategoryId.HasValue &&
            !await categoryRepository.ExistsAsync(request.ParentCategoryId.Value, cancellationToken))
        {
            throw new InvalidOperationException("La categoría padre no existe.");
        }
    }

    private async Task ValidateUpdateAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        ValidateRequiredFields(request.Name, request.Slug, request.DisplayOrder);

        if (request.ParentCategoryId == id)
        {
            throw new InvalidOperationException("Una categoría no puede ser padre de sí misma.");
        }

        if (await categoryRepository.ExistsBySlugAsync(request.Slug.Trim().ToLowerInvariant(), id, cancellationToken))
        {
            throw new InvalidOperationException("Ya existe una categoría con el mismo slug.");
        }

        if (request.ParentCategoryId.HasValue)
        {
            var parent = await categoryRepository.GetByIdAsync(request.ParentCategoryId.Value, cancellationToken);

            if (parent is null)
            {
                throw new InvalidOperationException("La categoría padre no existe.");
            }

            await ValidateHierarchyCycleAsync(id, parent, cancellationToken);
        }
    }

    private async Task ValidateHierarchyCycleAsync(int categoryId, Category parent, CancellationToken cancellationToken)
    {
        var current = parent;

        while (current.ParentCategoryId.HasValue)
        {
            if (current.Id == categoryId)
            {
                throw new InvalidOperationException("No se permiten ciclos en la jerarquía de categorías.");
            }

            var nextParent = await categoryRepository.GetByIdAsync(current.ParentCategoryId.Value, cancellationToken);

            if (nextParent is null)
            {
                break;
            }

            current = nextParent;
        }
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static void ValidateRequiredFields(string name, string slug, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("El nombre de la categoría es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(slug))
        {
            throw new ArgumentException("El slug de la categoría es obligatorio.");
        }

        if (displayOrder < 0)
        {
            throw new ArgumentException("El orden de visualización debe ser mayor o igual a cero.");
        }
    }

    private static CategoryDto MapToDto(Category category)
    {
        return new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            Slug = category.Slug,
            ParentCategoryId = category.ParentCategoryId,
            ParentCategoryName = category.ParentCategory?.Name,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            ImageUrl = category.ImageUrl,
            HomeImageUrl = category.HomeImageUrl,
            IconUrl = category.IconUrl,
            ShowInHome = category.ShowInHome,
            ShowInNavigation = category.ShowInNavigation,
            ShowInMegaMenu = category.ShowInMegaMenu,
            CreatedAt = category.CreatedAt,
            UpdatedAt = category.UpdatedAt
        };
    }

    private static CategoryTreeDto MapToTreeDto(Category category)
    {
        return new CategoryTreeDto
        {
            Id = category.Id,
            Name = category.Name,
            Slug = category.Slug,
            ParentCategoryId = category.ParentCategoryId,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            ShowInNavigation = category.ShowInNavigation,
            ShowInHome = category.ShowInHome,
            ShowInMegaMenu = category.ShowInMegaMenu
        };
    }
}