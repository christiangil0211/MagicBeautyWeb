using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Contracts.Categories.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

public sealed class CategoryHomeCarouselTests
{
    [Fact]
    public async Task ListsActiveCarouselsAtAnyLevelInCategoryOrderAndHidesInactiveBranches()
    {
        var name = Guid.NewGuid().ToString();
        await using (var seed = CreateDatabase(name))
        {
            seed.Categories.AddRange(
                new Category { Id = 1, Name = "Cuidado capilar", Slug = "cuidado-capilar", DisplayOrder = 20, ShowAsHomeCarousel = true },
                new Category { Id = 2, Name = "Shampoo", Slug = "shampoo", ParentCategoryId = 1, DisplayOrder = 10, ShowAsHomeCarousel = true },
                new Category { Id = 3, Name = "Maquillaje", Slug = "maquillaje", DisplayOrder = 30, IsActive = false },
                new Category { Id = 4, Name = "Labiales", Slug = "labiales", ParentCategoryId = 3, DisplayOrder = 10, ShowAsHomeCarousel = true },
                new Category { Id = 5, Name = "Uñas", Slug = "unas", DisplayOrder = 40, ShowAsHomeCarousel = true, IsActive = false },
                new Category { Id = 6, Name = "Rostro", Slug = "rostro", DisplayOrder = 50 });
            await seed.SaveChangesAsync();
        }

        await using var db = CreateDatabase(name);
        var carousels = await CreateService(db).GetHomeCarouselsAsync(default);

        // Shampoo (subcategoría) y Cuidado capilar; Labiales cuelga de una padre
        // inactiva y Uñas está inactiva.
        Assert.Equal(["shampoo", "cuidado-capilar"], carousels.Select(carousel => carousel.Slug));
    }

    [Fact]
    public async Task DoesNotAllowASixthCarouselButKeepsSavingTheOnesAlreadyOn()
    {
        var name = Guid.NewGuid().ToString();
        await using (var seed = CreateDatabase(name))
        {
            for (var id = 1; id <= 6; id++)
            {
                seed.Categories.Add(new Category
                {
                    Id = id, Name = "Categoría " + id, Slug = "categoria-" + id, DisplayOrder = id, ShowAsHomeCarousel = id <= 5
                });
            }
            await seed.SaveChangesAsync();
        }

        await using (var db = CreateDatabase(name))
        {
            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                CreateService(db).UpdateAsync(6, Request(6, carousel: true), default));
            Assert.Contains("máximo", error.Message);

            await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(db).CreateAsync(new CreateCategoryRequest
            {
                Name = "Nueva", Slug = "nueva", DisplayOrder = 7, ShowAsHomeCarousel = true
            }, default));

            // Una que ya lo tiene encendido sigue guardándose.
            await CreateService(db).UpdateAsync(1, Request(1, carousel: true), default);
            // Al apagar una, queda espacio para otra.
            await CreateService(db).UpdateAsync(2, Request(2, carousel: false), default);
            await CreateService(db).UpdateAsync(6, Request(6, carousel: true), default);
        }

        await using var verify = CreateDatabase(name);
        Assert.Equal(
            [1, 3, 4, 5, 6],
            await verify.Categories.Where(category => category.ShowAsHomeCarousel).OrderBy(category => category.Id).Select(category => category.Id).ToListAsync());
    }

    private static UpdateCategoryRequest Request(int id, bool carousel) => new()
    {
        Name = "Categoría " + id,
        Slug = "categoria-" + id,
        DisplayOrder = id,
        ShowAsHomeCarousel = carousel
    };

    private static MagicBeautyDbContext CreateDatabase(string name) =>
        new(new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(name).Options);

    private static CategoryService CreateService(MagicBeautyDbContext db) => new(
        new CategoryRepository(db),
        Mock.Of<IFileStorageFactory>(factory => factory.Get(FileStorageDestination.Categories) == Mock.Of<IFileStorage>()),
        NullLogger<CategoryService>.Instance);
}
