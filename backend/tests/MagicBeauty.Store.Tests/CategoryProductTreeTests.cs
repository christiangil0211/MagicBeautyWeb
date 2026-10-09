using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

public sealed class CategoryProductTreeTests
{
    [Theory]
    [InlineData(1, new int[] { 101, 102, 103, 104, 106 })]
    [InlineData(2, new int[] { 102, 103, 106 })]
    [InlineData(3, new int[] { 103 })]
    [InlineData(4, new int[] { 104 })]
    [InlineData(999, new int[] { })]
    public async Task CategoryReturnsOnlyItsEntireSubtreeWithoutDuplicateProducts(int categoryId, int[] expected)
    {
        using var db = await CreateDatabaseAsync();
        var result = await new ProductRepository(db).GetAllAsync(null, categoryId, null, null, default);
        Assert.Equal(expected, result.Select(product => product.Id).Order().ToArray());
    }

    [Fact]
    public async Task BrandAndActiveFiltersStillApplyToDescendantProducts()
    {
        using var db = await CreateDatabaseAsync();
        var result = await new ProductRepository(db).GetAllAsync(1, 1, true, null, default);
        Assert.Equal(new[] { 101, 102, 103 }, result.Select(product => product.Id).Order().ToArray());
    }

    [Fact]
    public async Task NoCategoryFilterStillReturnsAllProducts()
    {
        using var db = await CreateDatabaseAsync();
        var result = await new ProductRepository(db).GetAllAsync(null, null, null, null, default);
        Assert.Equal(6, result.Count);
    }

    private static async Task<MagicBeautyDbContext> CreateDatabaseAsync()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new MagicBeautyDbContext(options);
        db.Brands.AddRange(new Brand { Id = 1, Name = "First" }, new Brand { Id = 2, Name = "Second" });
        db.Categories.AddRange(
            new Category { Id = 1, Name = "Root", Slug = "root" },
            new Category { Id = 2, Name = "Child", Slug = "child", ParentCategoryId = 1 },
            new Category { Id = 3, Name = "Deep", Slug = "deep", ParentCategoryId = 2 },
            new Category { Id = 4, Name = "Sibling", Slug = "sibling", ParentCategoryId = 1 },
            new Category { Id = 5, Name = "Other", Slug = "other" });
        for (var id = 101; id <= 106; id++)
            db.Products.Add(new Product { Id = id, Name = "Product " + id, Reference = "ABC" + id, BrandId = id == 104 ? 2 : 1, IsActive = id != 106 });
        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = 101, CategoryId = 1 },
            new ProductCategory { ProductId = 102, CategoryId = 2 },
            new ProductCategory { ProductId = 102, CategoryId = 1 },
            new ProductCategory { ProductId = 103, CategoryId = 3 },
            new ProductCategory { ProductId = 104, CategoryId = 4 },
            new ProductCategory { ProductId = 105, CategoryId = 5 },
            new ProductCategory { ProductId = 106, CategoryId = 2 });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
