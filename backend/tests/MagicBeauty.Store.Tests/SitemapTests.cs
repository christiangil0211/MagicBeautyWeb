using System.Reflection;
using System.Xml.Linq;
using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Application.Features.Sitemap;
using MagicBeauty.Store.Contracts.Categories.Responses;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

/// <summary>
/// El sitemap publica las paginas del portal, las categorias activas y los
/// productos activos; un producto desactivado nunca aparece.
/// </summary>
public sealed class SitemapTests
{
    private const string Site = "https://www.magicbeautycosmetics.com";
    private static readonly XNamespace Ns = "http://www.sitemaps.org/schemas/sitemap/0.9";

    [Fact]
    public async Task ListsPortalPagesActiveCategoriesAndActiveProductsOnly()
    {
        using var db = await CreateDatabaseAsync();

        var locations = Locations(await Sitemap(db).BuildXmlAsync(Site, default));

        Assert.Equal(
            [
                Site + "/",
                Site + "/catalogo",
                Site + "/catalogos",
                Site + "/catalogo/categoria/maquillaje",
                Site + "/catalogo/categoria/labios",
                Site + "/catalogo/LAB201",
                Site + "/catalogo/LAB202",
                Site + "/catalogo/SOM205"
            ],
            locations);
    }

    [Fact]
    public async Task NeverListsInactiveProducts()
    {
        using var db = await CreateDatabaseAsync();

        var xml = await Sitemap(db).BuildXmlAsync(Site, default);

        Assert.DoesNotContain("LAB203", xml);
        Assert.DoesNotContain(Locations(xml), location => location.Contains("/admin") || location.Contains("/pedido"));
    }

    [Fact]
    public async Task SkipsCategoriesWithoutActiveProducts()
    {
        using var db = await CreateDatabaseAsync();

        var locations = Locations(await Sitemap(db).BuildXmlAsync(Site, default));

        // "Unas" esta activa pero vacia: su pagina no tendria nada que mostrar.
        Assert.DoesNotContain(Site + "/catalogo/categoria/unas", locations);
        // "Maquillaje" no tiene productos propios, pero si su subcategoria "Labios".
        Assert.Contains(Site + "/catalogo/categoria/maquillaje", locations);
    }

    [Fact]
    public async Task IsValidSitemapXmlWithLastModifiedForProducts()
    {
        var products = new Mock<IProductRepository>();
        products
            .Setup(repository => repository.GetActiveSitemapEntriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ProductSitemapEntry("ACE 009/A", new DateTime(2026, 10, 9, 15, 30, 0, DateTimeKind.Utc))]);
        products
            .Setup(repository => repository.GetCategoryIdsWithActiveProductsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var xml = await new SitemapService(products.Object, Categories().Object).BuildXmlAsync(Site + "/", default);
        var document = XDocument.Parse(xml);

        Assert.StartsWith("<?xml version=\"1.0\" encoding=\"utf-8\"?>", xml);
        Assert.Equal(Ns + "urlset", document.Root!.Name);

        var product = document.Root.Elements(Ns + "url").Last();

        // La referencia viaja codificada y la barra final del dominio no se duplica.
        Assert.Equal(Site + "/catalogo/ACE%20009%2FA", product.Element(Ns + "loc")!.Value);
        Assert.Equal("2026-10-09", product.Element(Ns + "lastmod")!.Value);
    }

    [Fact]
    public async Task EndpointIsPublicAndServesXmlAtTheRoot()
    {
        var service = new Mock<ISitemapService>();
        service.Setup(item => item.BuildXmlAsync(Site, It.IsAny<CancellationToken>())).ReturnsAsync("<urlset />");

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Store:PublicUrl"] = Site })
            .Build();
        var controller = new SitemapController(service.Object, configuration)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.Get(default);

        Assert.Equal("<urlset />", result.Content);
        Assert.StartsWith("application/xml", result.ContentType);
        Assert.NotNull(typeof(SitemapController).GetCustomAttribute<AllowAnonymousAttribute>());

        var route = typeof(SitemapController).GetMethod(nameof(SitemapController.Get))!.GetCustomAttribute<HttpGetAttribute>();

        Assert.Equal("/sitemap.xml", route!.Template);
    }

    [Fact]
    public async Task RelatedProductsComeFromTheSameCategoryWithoutTheProductItself()
    {
        using var db = await CreateDatabaseAsync();

        var related = await Catalog(db).GetRelatedProductsAsync("lab201", 1, default);

        // LAB203 comparte categoria pero esta inactivo; LAB201 es el propio producto.
        Assert.Equal(["SOM205"], related.Select(product => product.Reference).ToArray());
    }

    [Fact]
    public async Task RelatedProductsAreCompletedFromTheCatalogWhenTheCategoryIsSmall()
    {
        using var db = await CreateDatabaseAsync();

        var related = await Catalog(db).GetRelatedProductsAsync("LAB201", 5, default);

        // Primero los de su categoria, despues el resto del catalogo activo, sin repetir.
        Assert.Equal(["SOM205", "LAB202"], related.Select(product => product.Reference).ToArray());
    }

    [Fact]
    public async Task RelatedProductsRespectTheLimitAndRejectUnknownReferences()
    {
        using var db = await CreateDatabaseAsync();

        // LAB202 no tiene categoria: se ofrecen productos activos del catalogo, hasta el limite.
        var related = await Catalog(db).GetRelatedProductsAsync("LAB202", 1, default);

        Assert.Single(related);
        Assert.DoesNotContain(related, product => product.Reference == "LAB202");
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Catalog(db).GetRelatedProductsAsync("LAB203", 5, default));
    }

    private static string[] Locations(string xml) =>
        XDocument.Parse(xml).Root!.Elements(Ns + "url").Select(url => url.Element(Ns + "loc")!.Value).ToArray();

    private static SitemapService Sitemap(MagicBeautyDbContext db) => new(new ProductRepository(db), Categories().Object);

    /// <summary>Arbol publico tal como lo entrega CategoryService: solo categorias activas.</summary>
    private static Mock<ICategoryService> Categories()
    {
        var categories = new Mock<ICategoryService>();
        categories
            .Setup(service => service.GetCatalogTreeAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new CategoryMenuDto
                {
                    Id = 9,
                    Name = "Maquillaje",
                    Slug = "maquillaje",
                    Children = [new CategoryMenuDto { Id = 1, Name = "Labios", Slug = "labios" }]
                },
                new CategoryMenuDto { Id = 5, Name = "Unas", Slug = "unas" }
            ]);

        return categories;
    }

    private static CatalogService Catalog(MagicBeautyDbContext db)
    {
        var policy = new Mock<IPriceVisibilityPolicy>();
        policy
            .Setup(item => item.GetVisiblePriceTypesAsync(It.IsAny<PriceAudience>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var audience = new Mock<IPriceAudienceProvider>();
        audience.Setup(item => item.GetCurrent()).Returns(PriceAudience.Anonymous);

        return new CatalogService(new ProductRepository(db), policy.Object, audience.Object);
    }

    // 201 activo en Labios · 202 activo sin categoria · 203 inactivo en Labios · 205 activo en Labios
    private static async Task<MagicBeautyDbContext> CreateDatabaseAsync()
    {
        var options = new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new MagicBeautyDbContext(options);
        db.Brands.Add(new Brand { Id = 1, Name = "Milagros" });
        db.Categories.Add(new Category { Id = 1, Name = "Labios", Slug = "labios" });
        db.Products.AddRange(
            new Product { Id = 201, Reference = "LAB201", Name = "Labial rojo", BrandId = 1, IsActive = true },
            new Product { Id = 202, Reference = "LAB202", Name = "Labial nude", BrandId = 1, IsActive = true },
            new Product { Id = 203, Reference = "LAB203", Name = "Labial retirado", BrandId = 1, IsActive = false },
            new Product { Id = 205, Reference = "SOM205", Name = "Sombra doble", BrandId = 1, IsActive = true });
        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = 201, CategoryId = 1 },
            new ProductCategory { ProductId = 203, CategoryId = 1 },
            new ProductCategory { ProductId = 205, CategoryId = 1 });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
