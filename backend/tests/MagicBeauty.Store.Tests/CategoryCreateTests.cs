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

public sealed class CategoryCreateTests
{
    [Fact]
    public async Task CreatingSiblingsNeverModifiesOrRemovesExistingCategories()
    {
        var databaseName = Guid.NewGuid().ToString();
        var seededAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        await using (var seed = CreateDatabase(databaseName))
        {
            seed.Categories.AddRange(
                new Category { Id = 1, Name = "Cuidado capilar", Slug = "cuidado-capilar", DisplayOrder = 10, ImageUrl = "capilar.png", CreatedAt = seededAt, UpdatedAt = seededAt },
                new Category { Id = 2, Name = "Maquillaje", Slug = "maquillaje", DisplayOrder = 20, ShowInHome = true, CreatedAt = seededAt, UpdatedAt = seededAt },
                new Category { Id = 3, Name = "Labiales", Slug = "labiales", ParentCategoryId = 2, DisplayOrder = 10, CreatedAt = seededAt, UpdatedAt = seededAt });
            await seed.SaveChangesAsync();
        }

        var before = await SnapshotAsync(databaseName);
        var names = new[] { "Shampoo", "Acondicionador", "Mascarilla", "Tratamiento" };
        var createdIds = new List<int>();

        for (var index = 0; index < names.Length; index++)
        {
            // Un contexto por solicitud, igual que en la API.
            await using var db = CreateDatabase(databaseName);
            var created = await CreateService(db).CreateAsync(new CreateCategoryRequest
            {
                Name = names[index],
                Slug = names[index].ToLowerInvariant(),
                ParentCategoryId = 1,
                DisplayOrder = (index + 1) * 10
            }, default);
            createdIds.Add(created.Id);

            var current = await SnapshotAsync(databaseName);
            Assert.Equal(before.Count + index + 1, current.Count);
            foreach (var (id, state) in before) Assert.Equal(state, current[id]);
        }

        Assert.Equal(names.Length, createdIds.Distinct().Count());
        Assert.DoesNotContain(createdIds, before.ContainsKey);

        await using var verify = CreateDatabase(databaseName);
        var children = await verify.Categories.AsNoTracking()
            .Where(category => category.ParentCategoryId == 1)
            .OrderBy(category => category.DisplayOrder)
            .Select(category => category.Name)
            .ToListAsync();
        Assert.Equal(names, children);
    }

    [Fact]
    public async Task CreatingWithAnExistingSlugIsRejectedAndLeavesTheOriginalUntouched()
    {
        var databaseName = Guid.NewGuid().ToString();

        await using (var seed = CreateDatabase(databaseName))
        {
            seed.Categories.Add(new Category { Id = 1, Name = "Shampoo", Slug = "shampoo", DisplayOrder = 10 });
            await seed.SaveChangesAsync();
        }

        var before = await SnapshotAsync(databaseName);

        await using var db = CreateDatabase(databaseName);
        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService(db).CreateAsync(
            new CreateCategoryRequest { Name = "Acondicionador", Slug = "Shampoo", DisplayOrder = 20 }, default));

        Assert.Equal(before, await SnapshotAsync(databaseName));
    }

    private static MagicBeautyDbContext CreateDatabase(string name) =>
        new(new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(name).Options);

    private static CategoryService CreateService(MagicBeautyDbContext db) => new(
        new CategoryRepository(db),
        Mock.Of<IFileStorageFactory>(factory => factory.Get(FileStorageDestination.Categories) == Mock.Of<IFileStorage>()),
        NullLogger<CategoryService>.Instance);

    private static async Task<Dictionary<int, string>> SnapshotAsync(string databaseName)
    {
        await using var db = CreateDatabase(databaseName);
        var categories = await db.Categories.AsNoTracking().ToListAsync();

        return categories.ToDictionary(
            category => category.Id,
            category => string.Join('|',
                category.Name, category.Slug, category.Description, category.ParentCategoryId, category.DisplayOrder,
                category.IsActive, category.ShowInHome, category.ShowInNavigation, category.ShowInMegaMenu,
                category.ImageUrl, category.HomeImageUrl, category.IconUrl,
                category.CreatedAt.Ticks, category.UpdatedAt.Ticks));
    }
}
