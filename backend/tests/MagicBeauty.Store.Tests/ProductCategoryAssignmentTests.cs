using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

/// <summary>Asignacion masiva de una categoria desde el administrador de categorias.</summary>
public sealed class ProductCategoryAssignmentTests
{
    private const int HairCare = 1;
    private const int Shampoo = 2;
    private const int Conditioner = 3;
    private static readonly DateTime SeededAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task AssignsTheCategoryToActiveAndInactiveProductsWithoutChangingThem()
    {
        using var db = await CreateDatabaseAsync();
        var before = await SnapshotAsync(db);

        var result = await Service(db).AssignCategoryAsync(Request(Shampoo, 301, 302, 303), default);
        db.ChangeTracker.Clear();

        Assert.Equal(3, result.UpdatedCount);
        Assert.Equal(new[] { 301, 302, 303, 304 }, await ProductsInAsync(db, Shampoo));
        // Ni el estado ni ningun otro dato del producto cambia: solo aparece el vinculo.
        Assert.Equal(before, await SnapshotAsync(db));
        Assert.False((await db.Products.AsNoTracking().SingleAsync(product => product.Id == 303)).IsActive);
    }

    [Fact]
    public async Task AssignedProductsLeaveTheWithoutCategoryList()
    {
        using var db = await CreateDatabaseAsync();
        Assert.Equal(new[] { 301, 302, 303 }, await WithoutCategoryAsync(db));

        await Service(db).AssignCategoryAsync(Request(Shampoo, 301, 303), default);
        db.ChangeTracker.Clear();

        Assert.Equal(new[] { 302 }, await WithoutCategoryAsync(db));
    }

    [Theory]
    [InlineData(HairCare)]
    [InlineData(Shampoo)]
    public async Task AnyLevelOfTheTreeCanBeAssigned(int categoryId)
    {
        using var db = await CreateDatabaseAsync();

        var result = await Service(db).AssignCategoryAsync(Request(categoryId, 301), default);
        db.ChangeTracker.Clear();

        Assert.Equal(1, result.UpdatedCount);
        Assert.Contains(301, await ProductsInAsync(db, categoryId));
    }

    [Fact]
    public async Task NeverCreatesDuplicateLinksAndKeepsTheOtherCategories()
    {
        using var db = await CreateDatabaseAsync();

        // 304 ya esta en Shampoo y 305 en Acondicionador; 301 llega repetido.
        var result = await Service(db).AssignCategoryAsync(Request(Shampoo, 301, 301, 304, 305), default);
        db.ChangeTracker.Clear();

        Assert.Equal(2, result.UpdatedCount);
        Assert.Equal(new[] { 301, 304, 305 }, await ProductsInAsync(db, Shampoo));
        Assert.Equal(new[] { 305 }, await ProductsInAsync(db, Conditioner));
        Assert.Equal(4, await db.ProductCategories.CountAsync());

        // Repetir la operacion no cambia nada.
        var again = await Service(db).AssignCategoryAsync(Request(Shampoo, 301, 304, 305), default);
        Assert.Equal(0, again.UpdatedCount);
        Assert.Equal(4, await db.ProductCategories.CountAsync());
    }

    [Fact]
    public async Task RejectsAnEmptySelection()
    {
        using var db = await CreateDatabaseAsync();

        await Assert.ThrowsAsync<ArgumentException>(() => Service(db).AssignCategoryAsync(Request(Shampoo), default));

        Assert.Equal(2, await db.ProductCategories.CountAsync());
    }

    [Fact]
    public async Task RejectsACategoryThatDoesNotExist()
    {
        using var db = await CreateDatabaseAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => Service(db).AssignCategoryAsync(Request(999, 301), default));

        Assert.Equal(2, await db.ProductCategories.CountAsync());
    }

    [Fact]
    public async Task IsAllOrNothingWhenAProductDoesNotExist()
    {
        using var db = await CreateDatabaseAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service(db).AssignCategoryAsync(Request(Shampoo, 301, 302, 999), default));
        db.ChangeTracker.Clear();

        Assert.Equal(new[] { 304 }, await ProductsInAsync(db, Shampoo));
        Assert.Equal(new[] { 301, 302, 303 }, await WithoutCategoryAsync(db));
    }

    [Fact]
    public async Task SavesAllLinksInASingleOperation()
    {
        var repository = new Mock<IProductRepository>();
        repository.Setup(item => item.GetExistingIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync([301, 302, 303]);
        repository.Setup(item => item.GetIdsInCategoryAsync(Shampoo, It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        List<ProductCategory>? saved = null;
        repository
            .Setup(item => item.AddCategoryLinksAsync(It.IsAny<IEnumerable<ProductCategory>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<ProductCategory>, CancellationToken>((links, _) => saved = links.ToList())
            .Returns(Task.CompletedTask);
        var service = new ProductService(
            repository.Object,
            Mock.Of<IBrandRepository>(),
            Mock.Of<ICategoryRepository>(categories => categories.ExistsAsync(Shampoo, It.IsAny<CancellationToken>()) == Task.FromResult(true)),
            Mock.Of<IPriceTypeRepository>(),
            Mock.Of<IFileStorage>());

        await service.AssignCategoryAsync(Request(Shampoo, 301, 302, 303), default);

        Assert.Equal([301, 302, 303], saved!.Select(link => link.ProductId).ToArray());
        Assert.All(saved!, link => Assert.Equal(Shampoo, link.CategoryId));
        repository.Verify(item => item.AddCategoryLinksAsync(It.IsAny<IEnumerable<ProductCategory>>(), It.IsAny<CancellationToken>()), Times.Once);
        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        // No se carga ni se modifica ningun producto.
        repository.Verify(item => item.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static AssignCategoryToProductsRequest Request(int categoryId, params int[] productIds) =>
        new() { CategoryId = categoryId, ProductIds = [.. productIds] };

    private static ProductService Service(MagicBeautyDbContext db) => new(
        new ProductRepository(db),
        Mock.Of<IBrandRepository>(),
        new CategoryRepository(db),
        Mock.Of<IPriceTypeRepository>(),
        Mock.Of<IFileStorage>());

    private static async Task<int[]> ProductsInAsync(MagicBeautyDbContext db, int categoryId) =>
        await db.ProductCategories.AsNoTracking()
            .Where(link => link.CategoryId == categoryId)
            .Select(link => link.ProductId)
            .OrderBy(id => id)
            .ToArrayAsync();

    private static async Task<int[]> WithoutCategoryAsync(MagicBeautyDbContext db) =>
        (await new ProductRepository(db).GetAllAsync(null, null, null, false, null, default))
            .Select(product => product.Id)
            .Order()
            .ToArray();

    private static async Task<Dictionary<int, string>> SnapshotAsync(MagicBeautyDbContext db) =>
        (await db.Products.AsNoTracking().ToListAsync()).ToDictionary(
            product => product.Id,
            product => string.Join('|',
                product.Reference, product.Name, product.Description, product.BrandId, product.HasVariants,
                product.IsActive, product.CreatedAt.Ticks, product.UpdatedAt.Ticks));

    private static async Task<MagicBeautyDbContext> CreateDatabaseAsync()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new MagicBeautyDbContext(options);
        db.Brands.Add(new Brand { Id = 1, Name = "Milagros" });
        db.Categories.AddRange(
            new Category { Id = HairCare, Name = "Cuidado capilar", Slug = "cuidado-capilar" },
            new Category { Id = Shampoo, Name = "Shampoo", Slug = "shampoo", ParentCategoryId = HairCare },
            new Category { Id = Conditioner, Name = "Acondicionador", Slug = "acondicionador", ParentCategoryId = HairCare });
        db.Products.AddRange(
            NewProduct(301, "Shampoo sin sal", true),
            NewProduct(302, "Shampoo anticaspa", true),
            NewProduct(303, "Shampoo descontinuado", false),
            NewProduct(304, "Shampoo clasico", true),
            NewProduct(305, "Acondicionador dos en uno", true));
        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = 304, CategoryId = Shampoo },
            new ProductCategory { ProductId = 305, CategoryId = Conditioner });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    private static Product NewProduct(int id, string name, bool isActive) => new()
    {
        Id = id,
        Reference = "CAP" + id,
        Name = name,
        BrandId = 1,
        IsActive = isActive,
        CreatedAt = SeededAt,
        UpdatedAt = SeededAt
    };
}
