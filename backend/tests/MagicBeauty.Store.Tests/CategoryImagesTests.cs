using Xunit;
using MagicBeauty.Store.Application.Features.Products;
using Moq;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Categories;
using MagicBeauty.Store.Contracts.Categories.Requests;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Azure.Storage.Blobs;

public class CategoryImagesTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];
    [Fact]
    public async Task JsonUpdateCannotOverwriteUploadedUrls()
    {
        using var context = new Context();
        context.Category.ImageUrl = "managed-image"; context.Category.HomeImageUrl = "managed-home"; context.Category.IconUrl = "managed-icon";
        await context.Service.UpdateAsync(6, new UpdateCategoryRequest { Name = "Labiales", Slug = "labiales" }, default);
        Assert.Equal("managed-image", context.Category.ImageUrl); Assert.Equal("managed-home", context.Category.HomeImageUrl); Assert.Equal("managed-icon", context.Category.IconUrl);
    }
    [Fact]
    public void SelectsSeparateAzureContainersWithoutChangingProducts()
    {
        var options = new AzureBlobStorageOptions { ServiceUri = "https://stmagicbeautydev.blob.core.windows.net", ContainerName = "product-images", CategoryContainerName = "category-images" };
        var products = new AzureBlobFileStorage(options, NullLogger<AzureBlobFileStorage>.Instance);
        var factory = new FileStorageFactory(products, options, null, NullLogger<AzureBlobFileStorage>.Instance);
        Assert.Same(products, factory.Get(FileStorageDestination.Products));
        var field = typeof(AzureBlobFileStorage).GetField("container", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        Assert.Equal("product-images", ((BlobContainerClient)field.GetValue(factory.Get(FileStorageDestination.Products))!).Name);
        Assert.Equal("category-images", ((BlobContainerClient)field.GetValue(factory.Get(FileStorageDestination.Categories))!).Name);
    }
    [Theory]
    [InlineData("image")]
    [InlineData("home")]
    [InlineData("icon")]
    public async Task UploadPersistsPublicUrlAndActualBytes(string kind)
    {
        using var context = new Context();
        var result = await context.Upload(kind);
        var url = kind switch { "image" => result.ImageUrl, "home" => result.HomeImageUrl, _ => result.IconUrl };
        Assert.StartsWith("http://localhost:5070/media/categories/6/" + kind + "/", url);
        Assert.Equal(Png, await File.ReadAllBytesAsync(context.PathFor(url!)));
        Assert.Equal(url, context.Persisted(kind));
    }
    [Fact]
    public async Task ReplaceCommitsBeforeDeletingOldBlob()
    {
        using var context = new Context(); var first = await context.Upload("image"); var old = first.ImageUrl!;
        context.BeforeSave = () => Assert.True(File.Exists(context.PathFor(old)));
        var second = await context.Upload("image");
        Assert.NotEqual(old, second.ImageUrl); Assert.False(File.Exists(context.PathFor(old))); Assert.True(File.Exists(context.PathFor(second.ImageUrl!)));
    }
    [Fact]
    public async Task DeleteCommitsNullBeforeDeletingBlob()
    {
        using var context = new Context(); var first = await context.Upload("home"); var old = first.HomeImageUrl!;
        context.BeforeSave = () => { Assert.Null(context.Category.HomeImageUrl); Assert.True(File.Exists(context.PathFor(old))); };
        await context.Service.DeleteImageAsync(6, "home", default);
        Assert.Null(context.Persisted("home")); Assert.False(File.Exists(context.PathFor(old)));
    }
    [Fact]
    public async Task FailedPersistenceRemovesNewBlobAndKeepsPreviousUrlAndBlob()
    {
        using var context = new Context(); var first = await context.Upload("icon"); var old = first.IconUrl!; context.FailSave = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => context.Upload("icon"));
        Assert.Equal(old, context.Category.IconUrl); Assert.Equal(old, context.Persisted("icon")); Assert.True(File.Exists(context.PathFor(old)));
        Assert.Single(Directory.GetFiles(context.Root, "*", SearchOption.AllDirectories));
    }
    [Fact]
    public async Task FailedDeletePersistenceKeepsPreviousBlob()
    {
        using var context = new Context(); var first = await context.Upload("image"); context.FailSave = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => context.Service.DeleteImageAsync(6, "image", default));
        Assert.Equal(first.ImageUrl, context.Category.ImageUrl); Assert.True(File.Exists(context.PathFor(first.ImageUrl!)));
    }
    [Fact]
    public async Task DeletingCategoryCleansAllOwnedImages()
    {
        using var context = new Context(); await context.Upload("image"); await context.Upload("home"); await context.Upload("icon");
        await context.Service.DeleteAsync(6, default);
        Assert.Empty(Directory.GetFiles(context.Root, "*", SearchOption.AllDirectories));
    }
    [Fact]
    public async Task ExternalUrlIsNotDeleted()
    {
        using var context = new Context(); context.Category.ImageUrl = "https://external.example/image.png";
        await context.Service.DeleteImageAsync(6, "image", default); Assert.Null(context.Category.ImageUrl);
    }
    [Fact]
    public async Task SharedImageIsKept()
    {
        using var context = new Context(); var first = await context.Upload("image"); context.Category.IconUrl = first.ImageUrl;
        await context.Service.DeleteImageAsync(6, "image", default); Assert.True(File.Exists(context.PathFor(first.ImageUrl!)));
    }
    [Theory]
    [InlineData("svg")]
    [InlineData("../image")]
    public async Task RejectsUnknownKindWithoutWriting(string kind)
    {
        using var context = new Context(); await Assert.ThrowsAsync<ArgumentException>(() => context.Upload(kind)); Assert.Empty(Directory.GetFiles(context.Root, "*", SearchOption.AllDirectories));
    }
    [Fact]
    public async Task RejectsInvalidContent()
    {
        using var context = new Context(); await Assert.ThrowsAsync<ArgumentException>(() => context.Service.UploadImageAsync(6, "image", new MemoryStream([1, 2, 3]), 3, default));
    }
    [Theory]
    [InlineData(0, "home", true)]
    [InlineData(0, "image", true)]
    [InlineData(0, "icon", true)]
    [InlineData(1, "home", false)]
    [InlineData(1, "image", true)]
    [InlineData(1, "icon", true)]
    [InlineData(2, "home", false)]
    [InlineData(2, "image", false)]
    [InlineData(2, "icon", true)]
    [InlineData(3, "home", false)]
    [InlineData(3, "image", false)]
    [InlineData(3, "icon", true)]
    public async Task UploadRespectsPersistedHierarchy(int level, string kind, bool allowed)
    {
        using var context = new Context(level);
        if (allowed) await context.Upload(kind);
        else
        {
            context.Category.HomeImageUrl = "existing-home";
            context.Category.ImageUrl = "existing-image";
            await Assert.ThrowsAsync<InvalidOperationException>(() => context.Upload(kind));
            Assert.Empty(Directory.GetFiles(context.Root, "*", SearchOption.AllDirectories));
            Assert.Equal("existing-home", context.Category.HomeImageUrl);
            Assert.Equal("existing-image", context.Category.ImageUrl);
        }
    }
    [Fact]
    public async Task MovingCategoryPreservesExistingImagesAndAllowsExplicitCleanup()
    {
        using var context = new Context(2);
        context.Category.ParentCategoryId = null;
        context.Category.HomeImageUrl = "existing-home";
        context.Category.ImageUrl = "existing-image";
        await context.Service.UpdateAsync(6, new UpdateCategoryRequest { Name = "Labiales", Slug = "labiales", ParentCategoryId = 10 }, default);
        Assert.Equal("existing-home", context.Category.HomeImageUrl);
        Assert.Equal("existing-image", context.Category.ImageUrl);
        await context.Service.DeleteImageAsync(6, "home", default);
        Assert.Null(context.Category.HomeImageUrl);
    }
    [Fact]
    public async Task ProductUploadStillPersistsProductPathBytesAndMetadata()
    {
        using var context = new Context(3);
        var repository = new Mock<IProductRepository>();
        repository.Setup(r => r.GetByIdAsync(399, It.IsAny<CancellationToken>())).ReturnsAsync(new Product { Id = 399, Reference = "ABC123" });
        ProductImage? persisted = null;
        repository.Setup(r => r.AddImageAsync(It.IsAny<ProductImage>(), It.IsAny<CancellationToken>())).Callback<ProductImage, CancellationToken>((image, _) => persisted = image).Returns(Task.CompletedTask);
        var service = new ProductService(repository.Object, Mock.Of<IBrandRepository>(), Mock.Of<ICategoryRepository>(), Mock.Of<IPriceTypeRepository>(), new LocalFileStorage(new LocalFileStorageOptions { RootPath = context.Root }));
        var result = await service.UploadImageAsync(399, new ProductImageUpload(new MemoryStream(Png), Png.Length, "Product image", null, 2, false), default);
        Assert.StartsWith("http://localhost:5070/media/products/abc123/", result.Url);
        Assert.Equal(Png, await File.ReadAllBytesAsync(context.PathFor(result.Url)));
        Assert.NotNull(persisted);
        Assert.Equal(399, persisted.ProductId);
        Assert.Equal(result.Url, persisted.Url);
        Assert.Equal("Product image", result.AltText);
        Assert.Equal(2, result.DisplayOrder);
        repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    private sealed class Context : IDisposable
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "magicbeauty-category-tests", Guid.NewGuid().ToString("N"));
        public Category Category { get; } = new() { Id = 6, Name = "Labiales", Slug = "labiales" };
        public bool FailSave; private bool deleted; public Action? BeforeSave;
        private string? image, home, icon;
        public CategoryService Service { get; }
        public Context(int level = 0)
        {
            Directory.CreateDirectory(Root);
            var repository = new Mock<ICategoryRepository>();
            var hierarchy = new Dictionary<int, Category> { [6] = Category };
            var current = Category;
            for (var index = 0; index < level; index++)
            {
                current.ParentCategoryId = 10 + index;
                var parent = new Category { Id = 10 + index };
                hierarchy.Add(parent.Id, parent);
                current = parent;
            }
            repository.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync((int id, CancellationToken _) => hierarchy.GetValueOrDefault(id));
            repository.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(() => deleted ? new List<Category>() : new List<Category> { Category });
            repository.Setup(r => r.Delete(Category)).Callback(() => deleted = true);
            repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(() => { BeforeSave?.Invoke(); if (FailSave) throw new InvalidOperationException("Persistence failed"); image = Category.ImageUrl; home = Category.HomeImageUrl; icon = Category.IconUrl; return Task.FromResult(1); });
            var local = new LocalFileStorageOptions { RootPath = Root };
            var storage = new LocalFileStorage(local);
            var factory = new FileStorageFactory(storage, new AzureBlobStorageOptions(), local, NullLogger<AzureBlobFileStorage>.Instance);
            Service = new CategoryService(repository.Object, factory, NullLogger<CategoryService>.Instance);
        }
        public Task<MagicBeauty.Store.Contracts.Categories.Responses.CategoryDto> Upload(string kind) => Service.UploadImageAsync(6, kind, new MemoryStream(Png), Png.Length, default);
        public string? Persisted(string kind) => kind switch { "image" => image, "home" => home, _ => icon };
        public string PathFor(string url) => Path.Combine(Root, url["http://localhost:5070/media/".Length..].Replace('/', Path.DirectorySeparatorChar));
        public void Dispose() => Directory.Delete(Root, true);
    }
}
