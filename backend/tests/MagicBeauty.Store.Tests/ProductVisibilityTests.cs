using System.Reflection;
using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

/// <summary>
/// La tienda solo ve productos activos; administracion ve todos y puede
/// filtrarlos por estado y por tener o no categorias.
/// </summary>
public sealed class ProductVisibilityTests
{
    private const int Lips = 1;
    private const int Eyes = 2;

    // 201 activo con categoria · 202 activo sin categoria · 203 inactivo con categoria
    // 204 inactivo sin categoria · 205 activo en dos categorias (otra marca)
    private static readonly int[] ActiveIds = [201, 202, 205];

    [Fact]
    public async Task PublicListReturnsOnlyActiveProducts()
    {
        using var db = await CreateDatabaseAsync();

        var products = await Catalog(db).GetProductsAsync(null, null, null, default);

        Assert.Equal(ActiveIds, Ids(products.Select(product => product.Id)));
    }

    // La busqueda usa una intercalacion de SQL Server que el proveedor en memoria no
    // evalua, asi que aqui se comprueba el contrato: la tienda siempre pide solo
    // activos, tambien al buscar, y la restriccion viaja en la misma consulta.
    [Theory]
    [InlineData(null, null, "labial")]
    [InlineData(null, null, "  SOM204 ")]
    [InlineData(2, Eyes, "sombra retirada")]
    public async Task PublicSearchAlwaysAsksTheRepositoryForActiveProductsOnly(int? brandId, int? categoryId, string search)
    {
        var repository = new Mock<IProductRepository>(MockBehavior.Strict);
        repository
            .Setup(item => item.GetAllAsync(brandId, categoryId, true, null, search.Trim(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await Catalog(repository.Object).GetProductsAsync(brandId, categoryId, search, default);

        repository.Verify(
            item => item.GetAllAsync(It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Theory]
    [InlineData(true, false, "labial")]
    [InlineData(false, true, "sombra")]
    [InlineData(null, false, "LAB202")]
    public async Task AdminSearchTravelsTogetherWithStatusAndCategoryPresence(bool? isActive, bool hasCategories, string search)
    {
        var repository = new Mock<IProductRepository>(MockBehavior.Strict);
        repository
            .Setup(item => item.GetAllAsync(1, null, isActive, hasCategories, search, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await Admin(repository.Object).GetAllAsync(1, null, isActive, hasCategories, search, default);

        repository.VerifyAll();
    }

    [Theory]
    [InlineData(null, Lips, new[] { 201, 205 })]
    [InlineData(null, Eyes, new[] { 205 })]
    [InlineData(1, null, new[] { 201, 202 })]
    [InlineData(2, null, new[] { 205 })]
    [InlineData(1, Lips, new[] { 201 })]
    public async Task PublicFiltersNeverReturnInactiveProducts(int? brandId, int? categoryId, int[] expected)
    {
        using var db = await CreateDatabaseAsync();

        var products = await Catalog(db).GetProductsAsync(brandId, categoryId, null, default);

        Assert.Equal(expected, Ids(products.Select(product => product.Id)));
    }

    [Theory]
    [InlineData("LAB203")]
    [InlineData("lab203")]
    [InlineData("SOM204")]
    public async Task PublicDetailOfInactiveProductDoesNotExist(string reference)
    {
        using var db = await CreateDatabaseAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => Catalog(db).GetProductDetailAsync(reference, default));
    }

    [Fact]
    public async Task PublicDetailOfActiveProductIsAvailable()
    {
        using var db = await CreateDatabaseAsync();

        var product = await Catalog(db).GetProductDetailAsync("LAB201", default);

        Assert.Equal(201, product.Id);
    }

    [Fact]
    public async Task DeactivatingFromAdminHidesTheProductFromTheStoreAndReactivatingRestoresIt()
    {
        using var db = await CreateDatabaseAsync();

        await Admin(db).DeleteAsync(201, default);
        db.ChangeTracker.Clear();

        Assert.DoesNotContain(await Catalog(db).GetProductsAsync(null, null, null, default), product => product.Id == 201);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Catalog(db).GetProductDetailAsync("LAB201", default));
        Assert.False((await Admin(db).GetByIdAsync(201, default)).IsActive);

        var stored = await db.Products.SingleAsync(product => product.Id == 201);
        stored.IsActive = true;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        Assert.Contains(await Catalog(db).GetProductsAsync(null, null, null, default), product => product.Id == 201);
    }

    [Theory]
    [InlineData(null, new[] { 201, 202, 203, 204, 205 })]
    [InlineData(true, new[] { 201, 202, 205 })]
    [InlineData(false, new[] { 203, 204 })]
    public async Task AdminListsActiveAndInactiveProducts(bool? isActive, int[] expected)
    {
        using var db = await CreateDatabaseAsync();

        var products = await Admin(db).GetAllAsync(null, null, isActive, null, null, default);

        Assert.Equal(expected, Ids(products.Select(product => product.Id)));
        if (isActive.HasValue) Assert.All(products, product => Assert.Equal(isActive.Value, product.IsActive));
    }

    [Theory]
    [InlineData("LAB203", 203)]
    [InlineData("SOM204", 204)]
    public async Task AdminCanOpenInactiveProducts(string reference, int id)
    {
        using var db = await CreateDatabaseAsync();

        Assert.False((await Admin(db).GetByReferenceAsync(reference, default)).IsActive);
        Assert.Equal(reference, (await Admin(db).GetByIdAsync(id, default)).Reference);
    }

    [Theory]
    [InlineData(null, new[] { 201, 202, 203, 204, 205 })]
    [InlineData(false, new[] { 202, 204 })]
    [InlineData(true, new[] { 201, 203, 205 })]
    public async Task AdminFiltersByHavingCategories(bool? hasCategories, int[] expected)
    {
        using var db = await CreateDatabaseAsync();

        var products = await Admin(db).GetAllAsync(null, null, null, hasCategories, null, default);

        // Los totales salen de la lista filtrada: un producto en dos categorias cuenta una vez.
        Assert.Equal(expected, Ids(products.Select(product => product.Id)));
        if (hasCategories.HasValue)
            Assert.All(products, product => Assert.Equal(hasCategories.Value, product.Categories.Count > 0));
    }

    [Theory]
    // marca, categoria, estado, con categorias
    [InlineData(null, null, true, false, new[] { 202 })]
    [InlineData(null, null, false, false, new[] { 204 })]
    [InlineData(null, null, true, true, new[] { 201, 205 })]
    [InlineData(null, null, false, true, new[] { 203 })]
    [InlineData(1, null, null, false, new[] { 202 })]
    [InlineData(2, null, null, false, new[] { 204 })]
    [InlineData(2, null, true, false, new int[] { })]
    [InlineData(null, Lips, null, true, new[] { 201, 203, 205 })]
    [InlineData(null, Lips, null, false, new int[] { })]
    public async Task AdminCombinesCategoryPresenceWithTheOtherFilters(
        int? brandId,
        int? categoryId,
        bool? isActive,
        bool? hasCategories,
        int[] expected)
    {
        using var db = await CreateDatabaseAsync();

        var products = await Admin(db).GetAllAsync(brandId, categoryId, isActive, hasCategories, null, default);

        Assert.Equal(expected, Ids(products.Select(product => product.Id)));
    }

    [Fact]
    public async Task RemovingTheLastCategoryMovesTheProductToWithoutCategory()
    {
        using var db = await CreateDatabaseAsync();
        db.ProductCategories.RemoveRange(await db.ProductCategories.Where(link => link.ProductId == 205 && link.CategoryId == Eyes).ToListAsync());
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Aun le queda una categoria: sigue contando como categorizado.
        Assert.DoesNotContain(await Admin(db).GetAllAsync(null, null, null, false, null, default), product => product.Id == 205);

        db.ProductCategories.RemoveRange(await db.ProductCategories.Where(link => link.ProductId == 205).ToListAsync());
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        Assert.Contains(await Admin(db).GetAllAsync(null, null, null, false, null, default), product => product.Id == 205);
    }

    [Fact]
    public void OnlyTheCatalogControllerExposesProductsWithoutAdminRole()
    {
        var admin = typeof(ProductsController);
        Assert.Equal(AuthorizationPolicies.StoreAdmin, admin.GetCustomAttribute<AuthorizeAttribute>()?.Policy);
        Assert.Null(admin.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.DoesNotContain(
            admin.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly),
            action => action.GetCustomAttribute<AllowAnonymousAttribute>() is not null);

        // La cara publica solo conoce ICatalogService, que nunca devuelve inactivos.
        var constructor = Assert.Single(typeof(CatalogController).GetConstructors());
        Assert.Equal([typeof(ICatalogService)], constructor.GetParameters().Select(parameter => parameter.ParameterType).ToArray());
    }

    private static int[] Ids(IEnumerable<int> ids) => ids.Order().ToArray();

    private static CatalogService Catalog(MagicBeautyDbContext db) => Catalog(new ProductRepository(db));

    private static CatalogService Catalog(IProductRepository repository)
    {
        var policy = new Mock<IPriceVisibilityPolicy>();
        policy
            .Setup(item => item.GetVisiblePriceTypesAsync(It.IsAny<PriceAudience>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        return new CatalogService(
            repository,
            policy.Object,
            Mock.Of<IPriceAudienceProvider>(provider => provider.GetCurrent() == PriceAudience.Anonymous));
    }

    private static ProductService Admin(MagicBeautyDbContext db) => Admin(new ProductRepository(db));

    private static ProductService Admin(IProductRepository repository) => new(
        repository,
        Mock.Of<IBrandRepository>(),
        Mock.Of<ICategoryRepository>(),
        Mock.Of<IPriceTypeRepository>(),
        Mock.Of<IFileStorage>());

    private static async Task<MagicBeautyDbContext> CreateDatabaseAsync()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new MagicBeautyDbContext(options);
        db.Brands.AddRange(new Brand { Id = 1, Name = "Milagros" }, new Brand { Id = 2, Name = "Otra" });
        db.Categories.AddRange(
            new Category { Id = Lips, Name = "Labios", Slug = "labios" },
            new Category { Id = Eyes, Name = "Ojos", Slug = "ojos" });
        db.Products.AddRange(
            new Product { Id = 201, Reference = "LAB201", Name = "Labial rojo", BrandId = 1, IsActive = true },
            new Product { Id = 202, Reference = "LAB202", Name = "Labial nude", BrandId = 1, IsActive = true },
            new Product { Id = 203, Reference = "LAB203", Name = "Labial retirado", BrandId = 1, IsActive = false },
            new Product { Id = 204, Reference = "SOM204", Name = "Sombra retirada", BrandId = 2, IsActive = false },
            new Product { Id = 205, Reference = "SOM205", Name = "Sombra doble", BrandId = 2, IsActive = true });
        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = 201, CategoryId = Lips },
            new ProductCategory { ProductId = 203, CategoryId = Lips },
            new ProductCategory { ProductId = 205, CategoryId = Lips },
            new ProductCategory { ProductId = 205, CategoryId = Eyes });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
