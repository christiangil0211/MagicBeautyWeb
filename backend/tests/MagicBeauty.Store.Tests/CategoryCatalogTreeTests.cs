using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

public sealed class CategoryCatalogTreeTests
{
    [Fact]
    public async Task CatalogTreeIncludesActiveCategoriesOutsideTheMenuAndHidesInactiveBranches()
    {
        var categories = new List<Category>
        {
            new() { Id = 1, Name = "Maquillaje", Slug = "maquillaje", IsActive = true, ShowInNavigation = false },
            new() { Id = 6, Name = "Labiales", Slug = "labiales", ParentCategoryId = 1, IsActive = true },
            new() { Id = 2, Name = "Capilar", Slug = "capilar", IsActive = false },
            // Activa, pero su padre esta inactivo: no se publica.
            new() { Id = 7, Name = "Shampoo", Slug = "shampoo", ParentCategoryId = 2, IsActive = true }
        };

        var repository = new Mock<ICategoryRepository>();
        repository.Setup(item => item.GetAllForTreeAsync(It.IsAny<CancellationToken>())).ReturnsAsync(categories);

        var service = new CategoryService(
            repository.Object,
            Mock.Of<IFileStorageFactory>(factory => factory.Get(FileStorageDestination.Categories) == Mock.Of<IFileStorage>()),
            NullLogger<CategoryService>.Instance);

        var tree = await service.GetCatalogTreeAsync(default);

        var root = Assert.Single(tree);
        Assert.Equal("maquillaje", root.Slug);
        Assert.Equal(["labiales"], root.Children.Select(child => child.Slug).ToArray());
    }
}
