using System.Reflection;
using Azure.Storage.Blobs;
using MagicBeauty.Store.Api.Controllers;
using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.TraditionalCatalogs;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using MagicBeauty.Store.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public sealed class TraditionalCatalogTests
{
    private static readonly byte[] Pdf = "%PDF-1.7\n%test\n"u8.ToArray();
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

    [Theory]
    [InlineData(
        "https://www.canva.com/design/DAFabc123/xyzToken_9/view?utm_content=DAF&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink",
        "https://www.canva.com/design/DAFabc123/xyzToken_9/view?embed")]
    [InlineData("https://www.canva.com/design/DAFabc123/view?embed", "https://www.canva.com/design/DAFabc123/view?embed")]
    [InlineData(
        "https://www.canva.com/design/DAG6ebkid4Y/XQiyMidwSjjG8l9Pu16Lrw/edit?utm_source=sharebutton",
        "https://www.canva.com/design/DAG6ebkid4Y/XQiyMidwSjjG8l9Pu16Lrw/view?embed")]
    [InlineData("  https://canva.com/design/DAFabc123/watch  ", "https://www.canva.com/design/DAFabc123/view?embed")]
    [InlineData(
        "<div style=\"position: relative\"><iframe loading=\"lazy\" src=\"https://www.canva.com/design/DAFabc123/view?embed\" allowfullscreen=\"allowfullscreen\" allow=\"fullscreen\"></iframe></div>",
        "https://www.canva.com/design/DAFabc123/view?embed")]
    public void NormalizesCanvaLinksToTheOfficialEmbedUrl(string input, string expected)
    {
        Assert.Equal(expected, CanvaEmbedUrl.Normalize(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("http://www.canva.com/design/DAFabc123/view")]
    [InlineData("https://www.canva.com.evil.example/design/DAFabc123/view")]
    [InlineData("https://evil.example/www.canva.com/design/DAFabc123/view")]
    [InlineData("https://user@www.canva.com/design/DAFabc123/view")]
    [InlineData("https://www.canva.com:8443/design/DAFabc123/view")]
    [InlineData("https://www.canva.com/design/DAF%2E%2E/view")]
    [InlineData("https://www.canva.com/folder/DAFabc123/view")]
    [InlineData("javascript:alert(1)")]
    [InlineData("<iframe src=\"https://evil.example/design/x/view\"></iframe>")]
    public void RejectsLinksThatAreNotPublicCanvaDesigns(string? input)
    {
        Assert.Throws<ArgumentException>(() => CanvaEmbedUrl.Normalize(input));
    }

    [Fact]
    public void AcceptsOnlyRealPdfSignatures()
    {
        PdfUploadRules.EnsurePdf(Pdf);
        Assert.Throws<ArgumentException>(() => PdfUploadRules.EnsurePdf(Png));
        Assert.Throws<ArgumentException>(() => PdfUploadRules.EnsurePdf([]));
    }

    [Fact]
    public void PdfDownloadKeepsTheCatalogNameIncludingAccents()
    {
        var disposition = AzureBlobFileStorage.BuildAttachmentDisposition("Catálogo \"Navidad\".pdf");

        Assert.Equal(
            "attachment; filename=\"Catalogo Navidad.pdf\"; filename*=UTF-8''Cat%C3%A1logo%20%22Navidad%22.pdf",
            disposition);
    }

    [Fact]
    public void CatalogFilesUseTheirOwnAzureContainer()
    {
        var options = new AzureBlobStorageOptions
        {
            ServiceUri = "https://stmagicbeautydev.blob.core.windows.net",
            ContainerName = "product-images",
            CategoryContainerName = "category-images",
            CatalogContainerName = "catalog-files"
        };
        var products = new AzureBlobFileStorage(options, NullLogger<AzureBlobFileStorage>.Instance);
        var factory = new FileStorageFactory(products, options, null, NullLogger<AzureBlobFileStorage>.Instance);
        var field = typeof(AzureBlobFileStorage).GetField("container", BindingFlags.NonPublic | BindingFlags.Instance)!;

        Assert.Equal("catalog-files", ((BlobContainerClient)field.GetValue(factory.Get(FileStorageDestination.Catalogs))!).Name);
        Assert.Equal("category-images", ((BlobContainerClient)field.GetValue(factory.Get(FileStorageDestination.Categories))!).Name);
    }

    [Fact]
    public void CatalogContainerCannotBeSharedWithProductsOrCategories()
    {
        var options = new AzureBlobStorageOptions
        {
            ServiceUri = "https://stmagicbeautydev.blob.core.windows.net",
            ContainerName = "product-images",
            CategoryContainerName = "category-images",
            CatalogContainerName = "category-images"
        };
        var products = new AzureBlobFileStorage(options, NullLogger<AzureBlobFileStorage>.Instance);

        Assert.Throws<InvalidOperationException>(() =>
            new FileStorageFactory(products, options, null, NullLogger<AzureBlobFileStorage>.Instance));
    }

    [Fact]
    public async Task CreateStoresTheNormalizedEmbedUrlAndPublicListShowsOnlyActiveInOrder()
    {
        using var context = new Context();

        await context.Service.CreateAsync(Request("Navidad", order: 2), default);
        await context.Service.CreateAsync(Request("Inactivo", order: 0, isActive: false), default);
        var first = await context.Service.CreateAsync(Request("Maquillaje", order: 1), default);

        Assert.Equal("https://www.canva.com/design/DAFabc123/view?embed", first.CanvaEmbedUrl);

        var catalogs = await context.Service.GetPublicAsync(default);
        Assert.Equal(["Maquillaje", "Navidad"], catalogs.Select(catalog => catalog.Name).ToArray());
    }

    [Theory]
    [InlineData("", "https://www.canva.com/design/DAFabc123/view", 0)]
    [InlineData("Catálogo", "https://www.canva.com/design/DAFabc123/view", -1)]
    public async Task CreateRejectsInvalidData(string name, string canvaUrl, int order)
    {
        using var context = new Context();

        await Assert.ThrowsAsync<ArgumentException>(() => context.Service.CreateAsync(
            new CreateTraditionalCatalogRequest { Name = name, CanvaUrl = canvaUrl, DisplayOrder = order },
            default));
    }

    [Fact]
    public async Task UpdateChangesDataButNotTheUploadedFiles()
    {
        using var context = new Context();
        var created = await context.Service.CreateAsync(Request("Navidad"), default);
        var withPdf = await context.Service.UploadPdfAsync(created.Id, new MemoryStream(Pdf), Pdf.Length, default);

        await context.Service.UpdateAsync(created.Id, new UpdateTraditionalCatalogRequest
        {
            Name = "Navidad 2026",
            CanvaUrl = "https://www.canva.com/design/DAFother99/view",
            DisplayOrder = 5,
            IsActive = false
        }, default);

        var updated = await context.Service.GetByIdAsync(created.Id, default);
        Assert.Equal("Navidad 2026", updated.Name);
        Assert.Equal("https://www.canva.com/design/DAFother99/view?embed", updated.CanvaEmbedUrl);
        Assert.Equal(5, updated.DisplayOrder);
        Assert.False(updated.IsActive);
        Assert.Equal(withPdf.PdfUrl, updated.PdfUrl);
    }

    [Fact]
    public async Task UploadingAPdfReplacesThePreviousFile()
    {
        using var context = new Context();
        var created = await context.Service.CreateAsync(Request("Navidad"), default);

        var first = await context.Service.UploadPdfAsync(created.Id, new MemoryStream(Pdf), Pdf.Length, default);
        var second = await context.Service.UploadPdfAsync(created.Id, new MemoryStream(Pdf), Pdf.Length, default);

        Assert.NotEqual(first.PdfUrl, second.PdfUrl);
        Assert.StartsWith($"http://localhost:5070/media/catalogs/{created.Id}/pdf/", second.PdfUrl);
        Assert.False(File.Exists(context.PathFor(first.PdfUrl!)));
        Assert.Equal(Pdf, await File.ReadAllBytesAsync(context.PathFor(second.PdfUrl!)));
    }

    [Fact]
    public async Task RejectsFilesThatAreNotPdfOrImages()
    {
        using var context = new Context();
        var created = await context.Service.CreateAsync(Request("Navidad"), default);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            context.Service.UploadPdfAsync(created.Id, new MemoryStream(Png), Png.Length, default));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            context.Service.UploadCoverAsync(created.Id, new MemoryStream(Pdf), Pdf.Length, default));

        Assert.Empty(Directory.GetFiles(context.Root, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task DeletingACatalogRemovesItsCoverAndPdf()
    {
        using var context = new Context();
        var created = await context.Service.CreateAsync(Request("Navidad"), default);
        var withCover = await context.Service.UploadCoverAsync(created.Id, new MemoryStream(Png), Png.Length, default);
        var withPdf = await context.Service.UploadPdfAsync(created.Id, new MemoryStream(Pdf), Pdf.Length, default);

        Assert.True(File.Exists(context.PathFor(withCover.CoverImageUrl!)));

        await context.Service.DeleteAsync(created.Id, default);

        Assert.Empty(await context.Service.GetAllAsync(default));
        Assert.False(File.Exists(context.PathFor(withCover.CoverImageUrl!)));
        Assert.False(File.Exists(context.PathFor(withPdf.PdfUrl!)));
    }

    [Fact]
    public async Task RemovingTheCoverClearsItAndDeletesTheFile()
    {
        using var context = new Context();
        var created = await context.Service.CreateAsync(Request("Navidad"), default);
        var withCover = await context.Service.UploadCoverAsync(created.Id, new MemoryStream(Png), Png.Length, default);

        var result = await context.Service.DeleteCoverAsync(created.Id, default);

        Assert.Null(result.CoverImageUrl);
        Assert.False(File.Exists(context.PathFor(withCover.CoverImageUrl!)));
    }

    [Fact]
    public async Task MissingCatalogIsNotFound()
    {
        using var context = new Context();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => context.Service.GetByIdAsync(404, default));
    }

    [Fact]
    public void OnlyThePublicListIsAnonymousEverythingElseRequiresStoreAdmin()
    {
        var controller = typeof(TraditionalCatalogsController);
        var policy = controller.GetCustomAttribute<AuthorizeAttribute>();

        Assert.Equal(AuthorizationPolicies.StoreAdmin, policy?.Policy);

        var anonymous = controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(method => method.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
            .Select(method => method.Name)
            .ToArray();

        Assert.Equal([nameof(TraditionalCatalogsController.GetPublic)], anonymous);
    }

    private static CreateTraditionalCatalogRequest Request(string name, int order = 0, bool isActive = true) => new()
    {
        Name = name,
        CanvaUrl = "https://www.canva.com/design/DAFabc123/view",
        DisplayOrder = order,
        IsActive = isActive
    };

    internal sealed class Context : IDisposable
    {
        private readonly MagicBeautyDbContext db;

        public string Root { get; } = Path.Combine(Path.GetTempPath(), "magicbeauty-catalog-tests", Guid.NewGuid().ToString("N"));

        public TraditionalCatalogService Service { get; }

        public Context()
        {
            Directory.CreateDirectory(Root);
            db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var local = new LocalFileStorageOptions { RootPath = Root };
            var factory = new FileStorageFactory(
                new LocalFileStorage(local),
                new AzureBlobStorageOptions(),
                local,
                NullLogger<AzureBlobFileStorage>.Instance);

            Service = new TraditionalCatalogService(
                new TraditionalCatalogRepository(db),
                factory,
                new FakeCanvaLinkInspector(ShortLinks, BlockedEmbeds),
                NullLogger<TraditionalCatalogService>.Instance);
        }

        /// <summary>Destinos simulados de canva.link: las pruebas no salen a internet.</summary>
        public Dictionary<string, string?> ShortLinks { get; } = [];

        public HashSet<string> BlockedEmbeds { get; } = [];

        public string PathFor(string url) =>
            Path.Combine(Root, url["http://localhost:5070/media/".Length..].Replace('/', Path.DirectorySeparatorChar));

        public void Dispose()
        {
            db.Dispose();
            Directory.Delete(Root, true);
        }
    }
}

/// <summary>Canva simulado: las pruebas no salen a internet.</summary>
internal sealed class FakeCanvaLinkInspector(
    IReadOnlyDictionary<string, string?> targets,
    ISet<string> blockedEmbeds) : ICanvaLinkInspector
{
    public Task<string?> ResolveAsync(Uri shortLink, CancellationToken cancellationToken) =>
        Task.FromResult(targets.GetValueOrDefault(shortLink.ToString()));

    public Task<bool> IsEmbeddableAsync(Uri embedUrl, CancellationToken cancellationToken) =>
        Task.FromResult(!blockedEmbeds.Contains(embedUrl.ToString()));
}

public sealed class CanvaShareLinkTests
{
    private const string EditLink =
        "https://www.canva.com/design/DAG6ebkid4Y/XQiyMidwSjjG8l9Pu16Lrw/edit?utm_content=DAG6ebkid4Y&utm_source=sharebutton";

    [Fact]
    public async Task ShortLinkToAnEditLinkIsAcceptedAndPreviewedWhenCanvaAllowsIt()
    {
        using var context = new TraditionalCatalogTests.Context();
        context.ShortLinks["https://canva.link/linea-facial-mayoristas-magic"] = EditLink;

        var catalog = await context.Service.CreateAsync(
            new CreateTraditionalCatalogRequest { Name = "Línea facial", CanvaUrl = "https://canva.link/linea-facial-mayoristas-magic" },
            default);

        Assert.Equal("https://canva.link/linea-facial-mayoristas-magic", catalog.CanvaShareUrl);
        Assert.Equal("https://www.canva.com/design/DAG6ebkid4Y/XQiyMidwSjjG8l9Pu16Lrw/view?embed", catalog.CanvaEmbedUrl);
        Assert.True(catalog.CanvaEmbeddable);
    }

    [Fact]
    public async Task DesignThatCanvaDoesNotLetEmbedOpensInCanvaInstead()
    {
        using var context = new TraditionalCatalogTests.Context();
        context.BlockedEmbeds.Add("https://www.canva.com/design/DAFprivate/view?embed");

        var catalog = await context.Service.CreateAsync(
            new CreateTraditionalCatalogRequest { Name = "Privado", CanvaUrl = "https://www.canva.com/design/DAFprivate/edit" },
            default);

        Assert.False(catalog.CanvaEmbeddable);
        Assert.Equal("https://www.canva.com/design/DAFprivate/edit", catalog.CanvaShareUrl);

        var published = Assert.Single(await context.Service.GetPublicAsync(default));
        Assert.False(published.CanvaEmbeddable);
        Assert.Equal("https://www.canva.com/design/DAFprivate/edit", published.CanvaShareUrl);
    }

    [Fact]
    public async Task SavingAgainChecksCanvaAgain()
    {
        using var context = new TraditionalCatalogTests.Context();
        context.BlockedEmbeds.Add("https://www.canva.com/design/DAFlater/view?embed");
        var created = await context.Service.CreateAsync(
            new CreateTraditionalCatalogRequest { Name = "Luego", CanvaUrl = "https://www.canva.com/design/DAFlater/view" },
            default);
        Assert.False(created.CanvaEmbeddable);

        // En Canva se habilitó la inserción: basta con volver a guardar.
        context.BlockedEmbeds.Clear();
        await context.Service.UpdateAsync(created.Id, new UpdateTraditionalCatalogRequest
        {
            Name = "Luego",
            CanvaUrl = "https://www.canva.com/design/DAFlater/view",
            IsActive = true
        }, default);

        Assert.True((await context.Service.GetByIdAsync(created.Id, default)).CanvaEmbeddable);
    }

    [Fact]
    public async Task UnresolvableShortLinkIsRejected()
    {
        using var context = new TraditionalCatalogTests.Context();

        var error = await Assert.ThrowsAsync<ArgumentException>(() => context.Service.CreateAsync(
            new CreateTraditionalCatalogRequest { Name = "X", CanvaUrl = "https://canva.link/no-existe" },
            default));

        Assert.Contains("enlace corto", error.Message);
    }

    [Theory]
    [InlineData("https://canva.link/abc", true)]
    [InlineData("http://canva.link/abc", false)]
    [InlineData("https://canva.link/", false)]
    [InlineData("https://canva.link.evil.example/abc", false)]
    public void RecognizesOnlyHttpsCanvaShortLinks(string input, bool expected)
    {
        Assert.Equal(expected, MagicBeauty.Store.Application.Features.TraditionalCatalogs.CanvaEmbedUrl.TryGetShortLink(input, out _));
    }
}
