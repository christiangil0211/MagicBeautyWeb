using System.Text;

using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Application.Features.Pricing;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

public sealed class SlugsTests
{
    [Theory]
    [InlineData("PÚRPURE", "purpure")]
    [InlineData("Kevin & Coco", "kevin-coco")]
    [InlineData("  Ritual   Botánico ", "ritual-botanico")]
    [InlineData("La Poción", "la-pocion")]
    [InlineData("OG", "og")]
    [InlineData("***", "")]
    public void BuildsUrlFriendlySlugs(string name, string slug)
    {
        Assert.Equal(slug, Slugs.From(name));
    }

    [Fact]
    public void TreatsSpellingVariantsAsTheSameBrand()
    {
        Assert.Equal(Slugs.NameKey("PURPURE"), Slugs.NameKey("Purpure"));
        Assert.Equal(Slugs.NameKey("Purpure"), Slugs.NameKey("PÚRPURE"));
        Assert.Equal(Slugs.NameKey("Dear Body"), Slugs.NameKey("DEAR-BODY"));
        Assert.NotEqual(Slugs.NameKey("Bloomshell"), Slugs.NameKey("Bioaqua"));
    }

    [Fact]
    public void AddsANumberWhenTheSlugIsTaken()
    {
        var taken = new HashSet<string> { "purpure", "purpure-2" };

        Assert.Equal("purpure-3", Slugs.MakeUnique("purpure", taken.Contains));
        Assert.Equal("dear-body", Slugs.MakeUnique("dear-body", taken.Contains));
    }

    [Theory]
    [InlineData("dear-body", true)]
    [InlineData("og", true)]
    [InlineData("Dear-Body", false)]
    [InlineData("dear--body", false)]
    [InlineData("-dear", false)]
    [InlineData("dear body", false)]
    [InlineData("", false)]
    public void ValidatesSlugsTypedByThePerson(string slug, bool valid)
    {
        Assert.Equal(valid, Slugs.IsValid(slug));
    }

    [Fact]
    public void CleansSpacesInNames()
    {
        Assert.Equal("Dear Body", Slugs.CleanName("  Dear    Body "));
    }
}

public sealed class BrandLogoRulesTests
{
    internal static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];
    internal static readonly byte[] Webp = [.. "RIFF"u8, 0, 0, 0, 0, .. "WEBP"u8, 1, 2];

    private static byte[] Svg(string body) => Encoding.UTF8.GetBytes(body);

    [Fact]
    public void AcceptsPngWebpAndASimpleSvg()
    {
        Assert.Equal("image/png", BrandLogoRules.Detect(Png).ContentType);
        Assert.Equal("image/webp", BrandLogoRules.Detect(Webp).ContentType);
        Assert.Equal("image/svg+xml", BrandLogoRules.Detect(Svg(
            "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\"/></svg>")).ContentType);
    }

    [Theory]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><a href=\"javascript:alert(1)\"><rect/></a></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><image href=\"https://evil.example/x.png\"/></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><use xlink:href=\"//evil.example/x.svg#a\"/></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><foreignObject><div/></foreignObject></svg>")]
    [InlineData("<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY a \"b\">]><svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"><style>@import url(https://evil.example/a.css);</style></svg>")]
    public void RejectsSvgWithActiveContentOrExternalReferences(string svg)
    {
        Assert.Throws<ArgumentException>(() => BrandLogoRules.Detect(Svg(svg)));
    }

    [Fact]
    public void RejectsJpegGifAndOtherFiles()
    {
        Assert.Throws<ArgumentException>(() => BrandLogoRules.Detect([0xFF, 0xD8, 0xFF, 0xE0, 1, 2]));
        Assert.Throws<ArgumentException>(() => BrandLogoRules.Detect("GIF89a....."u8.ToArray()));
        Assert.Throws<ArgumentException>(() => BrandLogoRules.Detect("hola"u8.ToArray()));
    }
}

public sealed class BrandServiceTests : IDisposable
{
    private readonly MagicBeautyDbContext db;
    private readonly FakeStorage storage = new();
    private readonly BrandService service;

    public BrandServiceTests()
    {
        db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Brands.AddRange(
            new Brand { Id = 1, Name = "Purpure", Slug = "purpure", IsActive = true },
            new Brand { Id = 2, Name = "Dear Body", Slug = "dear-body", IsActive = true },
            new Brand { Id = 3, Name = "Sin productos", Slug = "sin-productos", IsActive = true, LogoUrl = "https://blob/brands/3/old.png" });
        db.Products.AddRange(
            new Product { Id = 10, Reference = "LAB010", Name = "Labial", BrandId = 1, IsActive = true },
            new Product { Id = 11, Reference = "SPL011", Name = "Splash", BrandId = 2, IsActive = true },
            new Product { Id = 12, Reference = "BOL012", Name = "Bolso", BrandId = null, IsActive = true },
            new Product { Id = 13, Reference = "DIA013", Name = "Diadema", BrandId = null, IsActive = false });
        db.SaveChanges();

        var factory = new Mock<IFileStorageFactory>();
        factory.Setup(item => item.Get(FileStorageDestination.Brands)).Returns(storage);
        service = new BrandService(new BrandRepository(db), factory.Object, NullLogger<BrandService>.Instance);
    }

    public void Dispose() => db.Dispose();

    [Fact]
    public async Task CreatesABrandWithAGeneratedSlug()
    {
        var created = await service.CreateAsync(new CreateBrandRequest { Name = "  Ritual   Botánico ", Description = "  Botánicos  " }, default);

        Assert.Equal("Ritual Botánico", created.Name);
        Assert.Equal("ritual-botanico", created.Slug);
        Assert.Equal("Botánicos", created.Description);
        Assert.Equal(0, created.ProductCount);
    }

    [Theory]
    [InlineData("PURPURE")]
    [InlineData("PÚRPURE")]
    [InlineData(" purpure ")]
    public async Task RejectsSpellingVariantsOfAnExistingBrand(string name)
    {
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(new CreateBrandRequest { Name = name }, default));

        Assert.Contains("Purpure", error.Message);
    }

    [Fact]
    public async Task KeepsSlugsUnique()
    {
        // "Purpure!" tiene otra clave de nombre en texto, pero el mismo slug base.
        db.Brands.Add(new Brand { Id = 4, Name = "Purpure Kids", Slug = "purpure-kids", IsActive = true });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UpdateAsync(2, new UpdateBrandRequest { Name = "Dear Body", Slug = "purpure", IsActive = true }, default));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UpdateAsync(2, new UpdateBrandRequest { Name = "Dear Body", Slug = "Dear Body!", IsActive = true }, default));

        var renamed = await service.UpdateAsync(2, new UpdateBrandRequest { Name = "Dear Body", Slug = "dear-body-oficial", IsActive = true }, default);
        Assert.Equal("dear-body-oficial", renamed.Slug);
    }

    [Fact]
    public async Task AssignsProductsWithoutABrandStraightAway()
    {
        var result = await service.AssignProductsAsync(1, new AssignBrandProductsRequest { ProductIds = [12, 13] }, default);

        Assert.Equal(2, result.UpdatedCount);
        Assert.Equal(1, (await Product(12)).BrandId);
        Assert.Equal(1, (await Product(13)).BrandId);
    }

    [Fact]
    public async Task NeverMovesAProductFromAnotherBrandWithoutConfirmation()
    {
        var conflict = await Assert.ThrowsAsync<BrandAssignmentConflictException>(() =>
            service.AssignProductsAsync(1, new AssignBrandProductsRequest { ProductIds = [11, 12] }, default));

        var item = Assert.Single(conflict.Conflicts);
        Assert.Equal(("SPL011", "Dear Body"), (item.Reference, item.CurrentBrandName));
        // Nada cambió: ni el producto en conflicto ni el que no tenía marca.
        Assert.Equal(2, (await Product(11)).BrandId);
        Assert.Null((await Product(12)).BrandId);
    }

    [Fact]
    public async Task MovesBetweenBrandsWhenConfirmedAndAProductNeverHasTwoBrands()
    {
        var result = await service.AssignProductsAsync(1, new AssignBrandProductsRequest { ProductIds = [11, 12], MoveFromOtherBrands = true }, default);

        Assert.Equal(2, result.UpdatedCount);
        Assert.Equal(1, (await Product(11)).BrandId);
        Assert.Equal(0, (await service.GetByIdAsync(2, default)).ProductCount);
        Assert.Equal(3, (await service.GetByIdAsync(1, default)).ProductCount);
    }

    [Fact]
    public async Task RemovingAProductFromItsBrandLeavesItWithoutBrand()
    {
        var result = await service.RemoveProductsAsync(new RemoveBrandProductsRequest { ProductIds = [10, 12] }, default);

        Assert.Equal(1, result.UpdatedCount);
        Assert.Null((await Product(10)).BrandId);
    }

    [Fact]
    public async Task RejectsUnknownProductsOrAnEmptySelection()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.AssignProductsAsync(1, new AssignBrandProductsRequest { ProductIds = [999] }, default));
        await Assert.ThrowsAsync<ArgumentException>(() => service.AssignProductsAsync(1, new AssignBrandProductsRequest { ProductIds = [] }, default));
    }

    [Fact]
    public async Task ListsTheProductsOfABrandOrWithoutBrandPaged()
    {
        var withoutBrand = await service.GetProductsAsync(1, BrandProductScope.WithoutBrand, null, 1, 25, default);
        var inBrand = await service.GetProductsAsync(1, BrandProductScope.InBrand, null, 1, 25, default);
        var all = await service.GetProductsAsync(1, BrandProductScope.All, null, 1, 2, default);

        Assert.Equal(["BOL012", "DIA013"], withoutBrand.Items.Select(item => item.Reference).Order().ToArray());
        Assert.Equal(["LAB010"], inBrand.Items.Select(item => item.Reference).ToArray());
        Assert.Equal(4, all.Total);
        Assert.Equal(2, all.Items.Count);
        // Primero los que no tienen marca: son los que suelen faltar por asignar.
        Assert.All(all.Items, item => Assert.Null(item.BrandId));
    }

    [Fact]
    public async Task ABrandWithProductsCannotBeDeletedOnlyDeactivated()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(1, default));

        var deactivated = await service.UpdateAsync(1, new UpdateBrandRequest { Name = "Purpure", IsActive = false }, default);
        Assert.False(deactivated.IsActive);
        Assert.Equal(1, deactivated.ProductCount);
    }

    [Fact]
    public async Task DeletingABrandWithoutProductsAlsoDeletesItsLogo()
    {
        await service.DeleteAsync(3, default);

        Assert.False(await db.Brands.AnyAsync(brand => brand.Id == 3));
        Assert.Contains("https://blob/brands/3/old.png", storage.Deleted);
    }

    [Fact]
    public async Task ReplacingTheLogoKeepsOneImageAndDeletesThePreviousOne()
    {
        var first = await service.UploadLogoAsync(3, new MemoryStream(BrandLogoRulesTests.Png), BrandLogoRulesTests.Png.Length, default);
        var second = await service.UploadLogoAsync(3, new MemoryStream(BrandLogoRulesTests.Webp), BrandLogoRulesTests.Webp.Length, default);

        Assert.EndsWith(".png", first.LogoUrl);
        Assert.EndsWith(".webp", second.LogoUrl);
        Assert.Equal(["https://blob/brands/3/old.png", first.LogoUrl!], storage.Deleted);
        Assert.Equal(second.LogoUrl, (await db.Brands.AsNoTracking().SingleAsync(brand => brand.Id == 3)).LogoUrl);
    }

    [Fact]
    public async Task RemovingTheLogoLeavesItEmptyAndDeletesTheFile()
    {
        var result = await service.DeleteLogoAsync(3, default);

        Assert.Null(result.LogoUrl);
        Assert.Equal(["https://blob/brands/3/old.png"], storage.Deleted);
    }

    [Fact]
    public async Task RejectsLogosThatAreTooLargeOrNotAllowed()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadLogoAsync(3, new MemoryStream(new byte[10]), BrandLogoRules.MaxBytes + 1, default));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadLogoAsync(3, new MemoryStream([0xFF, 0xD8, 0xFF, 0xE0]), 4, default));
        Assert.Empty(storage.Saved);
    }

    [Fact]
    public async Task TheApiAnswers409WithTheProductsThatWouldMove()
    {
        var controller = new BrandsController(service);

        var response = await controller.AssignProducts(1, new AssignBrandProductsRequest { ProductIds = [11] }, default);

        var conflict = Assert.IsType<ConflictObjectResult>(response.Result);
        Assert.Contains("SPL011", System.Text.Json.JsonSerializer.Serialize(conflict.Value));
    }

    private Task<Product> Product(int id) => db.Products.AsNoTracking().SingleAsync(product => product.Id == id);

    private sealed class FakeStorage : IFileStorage
    {
        public List<string> Saved { get; } = [];
        public List<string> Deleted { get; } = [];

        public Task<string> SaveAsync(string path, Stream content, string contentType, CancellationToken cancellationToken)
        {
            var url = "https://blob/" + path;
            Saved.Add(url);
            return Task.FromResult(url);
        }

        public Task<string> SaveForDownloadAsync(string path, Stream content, string contentType, string downloadFileName, CancellationToken cancellationToken)
            => SaveAsync(path, content, contentType, cancellationToken);

        public Task DeleteByUrlAsync(string url, CancellationToken cancellationToken)
        {
            Deleted.Add(url);
            return Task.CompletedTask;
        }
    }
}

public sealed class PublicBrandsTests : IDisposable
{
    private readonly MagicBeautyDbContext db;
    private readonly CatalogService catalog;

    public PublicBrandsTests()
    {
        db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.PriceTypes.Add(new PriceType { Id = 1, Code = "RETAIL", Name = "Detal", IsDefault = true, IsPublic = true, IsActive = true });
        db.Brands.AddRange(
            new Brand { Id = 1, Name = "Purpure", Slug = "purpure", IsActive = true, IsFeatured = true, LogoUrl = "https://blob/purpure.png", SortOrder = 2 },
            new Brand { Id = 2, Name = "Dear Body", Slug = "dear-body", IsActive = true, SortOrder = 1 },
            new Brand { Id = 3, Name = "Retirada", Slug = "retirada", IsActive = false },
            new Brand { Id = 4, Name = "Sin fichas completas", Slug = "sin-fichas", IsActive = true },
            // Comodín antiguo: sigue en la base hasta el script de datos, pero no es una marca.
            new Brand { Id = 5, Name = "Sin marca", Slug = "sin-marca", IsActive = true });
        db.Products.AddRange(
            Complete(new Product { Id = 1, Reference = "PUR001", Name = "Labial", BrandId = 1, IsActive = true }),
            Complete(new Product { Id = 2, Reference = "PUR002", Name = "Brillo", BrandId = 1, IsActive = true }),
            Complete(new Product { Id = 3, Reference = "PUR003", Name = "Retirado", BrandId = 1, IsActive = false }),
            new Product { Id = 4, Reference = "PUR004", Name = "Sin foto", BrandId = 1, IsActive = true },
            Complete(new Product { Id = 5, Reference = "DEA005", Name = "Splash", BrandId = 2, IsActive = true }),
            Complete(new Product { Id = 6, Reference = "RET006", Name = "De marca inactiva", BrandId = 3, IsActive = true }),
            new Product { Id = 7, Reference = "SIN007", Name = "Incompleto", BrandId = 4, IsActive = true },
            Complete(new Product { Id = 8, Reference = "BOL008", Name = "Bolso", BrandId = null, IsActive = true }),
            Complete(new Product { Id = 9, Reference = "DIA009", Name = "Diadema", BrandId = 5, IsActive = true }));
        db.SaveChanges();

        var policy = new Mock<IPriceVisibilityPolicy>();
        policy.Setup(item => item.GetVisiblePriceTypesAsync(It.IsAny<PriceAudience>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([new PriceType { Id = 1, Code = "RETAIL", Name = "Detal" }]);

        catalog = new CatalogService(
            new ProductRepository(db),
            new BrandRepository(db),
            policy.Object,
            Mock.Of<IPriceAudienceProvider>(provider => provider.GetCurrent() == PriceAudience.Anonymous));
    }

    public void Dispose() => db.Dispose();

    [Fact]
    public async Task ListsOnlyActiveBrandsWithCompleteProductsInOrder()
    {
        var brands = await catalog.GetBrandsAsync(default);

        Assert.Equal(["dear-body", "purpure"], brands.Select(brand => brand.Slug).ToArray());
        Assert.Equal(2, brands.Single(brand => brand.Slug == "purpure").ProductCount);
        Assert.True(brands.Single(brand => brand.Slug == "purpure").IsFeatured);
    }

    [Fact]
    public async Task ABrandPageShowsOnlyCompleteProductsPaged()
    {
        var page = await catalog.GetBrandPageAsync("PURPURE", 1, 1, default);

        Assert.Equal("Purpure", page.Brand.Name);
        Assert.Equal(2, page.Total);
        Assert.Single(page.Products);
        Assert.All(page.Products, product => Assert.Equal("purpure", product.BrandSlug));

        var second = await catalog.GetBrandPageAsync("purpure", 2, 1, default);
        Assert.NotEqual(page.Products[0].Reference, second.Products[0].Reference);
    }

    [Theory]
    [InlineData("no-existe")]
    [InlineData("retirada")]
    [InlineData("sin-marca")]
    [InlineData("../admin")]
    [InlineData("")]
    public async Task UnknownOrInactiveBrandsAreNotFound(string slug)
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => catalog.GetBrandPageAsync(slug, 1, 10, default));
    }

    [Fact]
    public async Task ProductsWithoutBrandOrWithAnInactiveBrandDoNotLinkToABrandPage()
    {
        var products = await catalog.GetProductsAsync(null, null, null, default);

        Assert.Null(products.Single(product => product.Reference == "BOL008").BrandSlug);
        Assert.Equal(string.Empty, products.Single(product => product.Reference == "BOL008").BrandName);
        Assert.Null(products.Single(product => product.Reference == "RET006").BrandSlug);
        Assert.Equal("dear-body", products.Single(product => product.Reference == "DEA005").BrandSlug);
        Assert.Null(products.Single(product => product.Reference == "DIA009").BrandSlug);
    }

    [Fact]
    public async Task TheProductListFiltersProductsWithoutBrand()
    {
        var withoutBrand = await new ProductRepository(db).GetAllAsync(ProductFilters.WithoutBrand, null, null, null, null, default);

        Assert.Equal(["BOL008"], withoutBrand.Select(product => product.Reference).ToArray());
    }

    private static Product Complete(Product product)
    {
        product.Images.Add(new ProductImage { Url = "https://cdn/" + product.Reference + ".jpg", IsActive = true, IsMain = true });
        product.Prices.Add(new ProductPrice { PriceTypeId = 1, Amount = 10000, IsActive = true });
        return product;
    }
}
