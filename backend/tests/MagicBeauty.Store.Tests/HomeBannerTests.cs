using System.Buffers.Binary;

using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.HomeBanners;
using MagicBeauty.Store.Contracts.HomeBanners;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Infrastructure.Persistence;
using MagicBeauty.Store.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

/// <summary>Cabeceras mínimas de imágenes reales, con las medidas pedidas.</summary>
internal static class BannerImages
{
    public static byte[] Png(int width, int height)
    {
        var bytes = new byte[33];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13 }.CopyTo(bytes, 0);
        "IHDR"u8.ToArray().CopyTo(bytes, 12);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(16), (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(20), (uint)height);
        return bytes;
    }

    /// <summary>SOI, un APP0 de relleno y el SOF0 con alto y ancho.</summary>
    public static byte[] Jpeg(int width, int height)
    {
        var bytes = new List<byte> { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x06, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xC0, 0x00, 0x11, 0x08 };
        bytes.AddRange([(byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width]);
        bytes.AddRange(new byte[12]);
        return [.. bytes];
    }

    public static byte[] WebpExtended(int width, int height)
    {
        var bytes = new byte[34];
        "RIFF"u8.ToArray().CopyTo(bytes, 0);
        "WEBP"u8.ToArray().CopyTo(bytes, 8);
        "VP8X"u8.ToArray().CopyTo(bytes, 12);
        WriteUInt24(bytes, 24, width - 1);
        WriteUInt24(bytes, 27, height - 1);
        return bytes;
    }

    public static byte[] WebpLossy(int width, int height)
    {
        var bytes = new byte[34];
        "RIFF"u8.ToArray().CopyTo(bytes, 0);
        "WEBP"u8.ToArray().CopyTo(bytes, 8);
        "VP8 "u8.ToArray().CopyTo(bytes, 12);
        bytes[23] = 0x9D;
        bytes[24] = 0x01;
        bytes[25] = 0x2A;
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(26), (ushort)width);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(28), (ushort)height);
        return bytes;
    }

    public static byte[] WebpLossless(int width, int height)
    {
        var bytes = new byte[34];
        "RIFF"u8.ToArray().CopyTo(bytes, 0);
        "WEBP"u8.ToArray().CopyTo(bytes, 8);
        "VP8L"u8.ToArray().CopyTo(bytes, 12);
        bytes[20] = 0x2F;
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(21), (uint)((width - 1) | (height - 1) << 14));
        return bytes;
    }

    private static void WriteUInt24(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)value;
        bytes[offset + 1] = (byte)(value >> 8);
        bytes[offset + 2] = (byte)(value >> 16);
    }
}

public sealed class BannerImageRulesTests
{
    [Fact]
    public void ReadsTheRealSizeOfEachFormat()
    {
        Assert.Equal((2172, 724), Size(BannerImageRules.Read(BannerImages.Png(2172, 724))));
        Assert.Equal((2172, 724), Size(BannerImageRules.Read(BannerImages.Jpeg(2172, 724))));
        Assert.Equal((2172, 724), Size(BannerImageRules.Read(BannerImages.WebpExtended(2172, 724))));
        Assert.Equal((1280, 427), Size(BannerImageRules.Read(BannerImages.WebpLossy(1280, 427))));
        Assert.Equal((768, 256), Size(BannerImageRules.Read(BannerImages.WebpLossless(768, 256))));

        Assert.Equal("image/jpeg", BannerImageRules.Read(BannerImages.Jpeg(2172, 724)).Format.ContentType);
    }

    [Fact]
    public void AcceptsThreeToOneBannersWithRoundingMargin()
    {
        BannerImageRules.ValidateOriginal(BannerImages.Png(2172, 724));
        BannerImageRules.ValidateOriginal(BannerImages.Png(2000, 671));
        BannerImageRules.ValidateOriginal(BannerImages.Png(3000, 1000));
    }

    [Theory]
    [InlineData(1920, 1080)] // 16:9
    [InlineData(1080, 1080)] // cuadrada
    [InlineData(1200, 400)] // muy pequeña
    [InlineData(6000, 2000)] // demasiado grande
    public void RejectsOtherProportionsOrSizes(int width, int height)
    {
        Assert.Throws<ArgumentException>(() => BannerImageRules.ValidateOriginal(BannerImages.Png(width, height)));
    }

    [Fact]
    public void RejectsGifsAndUnknownFiles()
    {
        Assert.Throws<ArgumentException>(() => BannerImageRules.Read("GIF89a\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"u8));
        Assert.Throws<ArgumentException>(() => BannerImageRules.Read("<svg></svg>"u8));
    }

    [Fact]
    public void VariantsMustHaveTheExpectedWidth()
    {
        BannerImageRules.ValidateVariant(BannerImages.WebpLossy(768, 256), 768);
        Assert.Throws<ArgumentException>(() => BannerImageRules.ValidateVariant(BannerImages.WebpLossy(800, 267), 768));
        Assert.Throws<ArgumentException>(() => BannerImageRules.ValidateVariant(BannerImages.WebpLossy(768, 432), 768));
    }

    private static (int, int) Size(BannerImageRules.BannerImage image) => (image.Width, image.Height);
}

public sealed class HomeBannerServiceTests : IDisposable
{
    private readonly MagicBeautyDbContext db;
    private readonly FakeStorage storage = new();
    private readonly FixedClock clock = new(new DateTimeOffset(2026, 12, 10, 15, 0, 0, TimeSpan.Zero));
    private readonly HomeBannerService service;

    public HomeBannerServiceTests()
    {
        db = new MagicBeautyDbContext(new DbContextOptionsBuilder<MagicBeautyDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

        var factory = new Mock<IFileStorageFactory>();
        factory.Setup(item => item.Get(FileStorageDestination.Banners)).Returns(storage);
        service = new HomeBannerService(new HomeBannerRepository(db), factory.Object, clock, NullLogger<HomeBannerService>.Instance);
    }

    public void Dispose() => db.Dispose();

    private static SaveHomeBannerRequest Request(string name = "promo") => new()
    {
        Name = name,
        Title = "Gran promo",
        AltText = "Gran promo de diciembre: 20% en maquillaje.",
        IsActive = true
    };

    private Banner Seed(int id, int order, bool active = true, string? image = "https://blob/a.webp", DateOnly? starts = null, DateOnly? ends = null)
    {
        var banner = new Banner
        {
            Id = id, Name = $"b{id}", Title = $"Banner {id}", AltText = "alt", ImageUrl = image, ImageWidth = 2172, ImageHeight = 724,
            SortOrder = order, IsActive = active, StartsOn = starts, EndsOn = ends
        };
        db.Set<Banner>().Add(banner);
        db.SaveChanges();
        return banner;
    }

    [Fact]
    public async Task CreatesNewBannersAtTheEndOfTheCarousel()
    {
        Seed(1, 1);
        Seed(2, 7);

        var created = await service.CreateAsync(Request(), default);

        Assert.Equal(8, created.SortOrder);
        Assert.False(created.IsVisibleToday); // aún no tiene imagen
    }

    [Theory]
    [InlineData("https://otro-sitio.com")]
    [InlineData("//otro-sitio.com")]
    [InlineData("javascript:alert(1)")]
    [InlineData("catalogo")]
    [InlineData("/catalogo<script>")]
    public async Task OnlyLinksToPagesOfTheStore(string link)
    {
        var request = Request();
        request.Link = new HomeBannerLinkDto { Label = "Ver", Link = link };

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request, default));
    }

    [Fact]
    public async Task KeepsHotspotsAndMobileButtons()
    {
        var request = Request();
        request.Hotspots = [new HomeBannerHotspotDto { Label = "Ver catálogo", Link = "/catalogo?categoria=labiales", Left = 2.6m, Top = 80, Width = 16.4m, Height = 11.6m }];
        request.MobileCtas = [new HomeBannerLinkDto { Label = "Ver catálogo", Link = "/catalogo" }];

        var created = await service.CreateAsync(request, default);

        var spot = Assert.Single(created.Hotspots);
        Assert.Equal(("Ver catálogo", "/catalogo?categoria=labiales", 2.6m, 80m), (spot.Label, spot.Link, spot.Left, spot.Top));
        Assert.Equal("/catalogo", Assert.Single(created.MobileCtas).Link);
    }

    [Fact]
    public async Task RejectsAWholeImageLinkTogetherWithHotspots()
    {
        var request = Request();
        request.Link = new HomeBannerLinkDto { Label = "Ver", Link = "/catalogo" };
        request.Hotspots = [new HomeBannerHotspotDto { Label = "Ver", Link = "/catalogo", Left = 1, Top = 1, Width = 10, Height = 10 }];

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request, default));
    }

    [Fact]
    public async Task RejectsHotspotsOutsideTheImage()
    {
        var request = Request();
        request.Hotspots = [new HomeBannerHotspotDto { Label = "Ver", Link = "/catalogo", Left = 95, Top = 10, Width = 20, Height = 10 }];

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request, default));
    }

    [Fact]
    public async Task RejectsAnEndBeforeTheStart()
    {
        var request = Request();
        request.StartsOn = new DateOnly(2026, 12, 20);
        request.EndsOn = new DateOnly(2026, 12, 1);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request, default));
    }

    [Fact]
    public async Task TheStoreOnlyGetsActiveBannersWithImageInTheirDates()
    {
        Seed(1, 3);
        Seed(2, 1);
        Seed(3, 2, active: false);
        Seed(4, 4, image: null);
        Seed(5, 5, starts: new DateOnly(2026, 12, 11));
        Seed(6, 6, ends: new DateOnly(2026, 12, 9));
        Seed(7, 7, starts: new DateOnly(2026, 12, 10), ends: new DateOnly(2026, 12, 10));

        var visible = await service.GetVisibleAsync(default);

        Assert.Equal([2, 1, 7], visible.Select(banner => banner.Id));
    }

    [Fact]
    public async Task UsesTheColombianDateForTheDates()
    {
        // 24-dic a las 21:00 en Cali ya es 25-dic en UTC: el banner hasta el 24 sigue visible.
        clock.Now = new DateTimeOffset(2026, 12, 25, 2, 0, 0, TimeSpan.Zero);
        Seed(1, 1, ends: new DateOnly(2026, 12, 24));

        Assert.Single(await service.GetVisibleAsync(default));

        clock.Now = new DateTimeOffset(2026, 12, 25, 5, 0, 0, TimeSpan.Zero);
        Assert.Empty(await service.GetVisibleAsync(default));
    }

    [Fact]
    public async Task ReordersTheWholeCarousel()
    {
        Seed(1, 1);
        Seed(2, 2);
        Seed(3, 3);

        var result = await service.ReorderAsync(new ReorderHomeBannersRequest { Ids = [3, 1, 2] }, default);

        Assert.Equal([3, 1, 2], result.Select(banner => banner.Id));
        Assert.Equal([1, 2, 3], result.Select(banner => banner.SortOrder));
    }

    [Theory]
    [InlineData(new[] { 1, 2 })]
    [InlineData(new[] { 1, 2, 2 })]
    [InlineData(new[] { 1, 2, 9 })]
    public async Task RefusesAnIncompleteOrder(int[] ids)
    {
        Seed(1, 1);
        Seed(2, 2);
        Seed(3, 3);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ReorderAsync(new ReorderHomeBannersRequest { Ids = [.. ids] }, default));
    }

    [Fact]
    public async Task UploadsTheImageWithItsCopiesAndDeletesTheOldOnes()
    {
        var banner = Seed(1, 1, image: "https://blob/home-banners/1/old.webp");
        banner.ImageUrl768 = "https://blob/home-banners/1/old-768.webp";
        db.SaveChanges();

        var result = await service.UploadImageAsync(
            1,
            Upload(BannerImages.Jpeg(2172, 724)),
            Upload(BannerImages.WebpLossy(768, 256)),
            Upload(BannerImages.WebpLossy(1280, 427)),
            default);

        Assert.Equal(3, storage.Saved.Count);
        Assert.EndsWith(".jpg", result.ImageUrl);
        Assert.EndsWith("-768.webp", result.ImageUrl768);
        Assert.EndsWith("-1280.webp", result.ImageUrl1280);
        Assert.Equal((2172, 724), (result.ImageWidth, result.ImageHeight));
        Assert.Equal(["https://blob/home-banners/1/old.webp", "https://blob/home-banners/1/old-768.webp"], storage.Deleted);
    }

    [Fact]
    public async Task SavesNothingIfACopyIsWrong()
    {
        Seed(1, 1, image: "https://blob/home-banners/1/old.webp");

        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadImageAsync(
            1,
            Upload(BannerImages.Jpeg(2172, 724)),
            Upload(BannerImages.WebpLossy(1280, 427)),
            null,
            default));

        Assert.Empty(storage.Saved);
        Assert.Equal("https://blob/home-banners/1/old.webp", (await service.GetByIdAsync(1, default)).ImageUrl);
    }

    [Fact]
    public async Task RejectsAnImageWithTheWrongProportion()
    {
        Seed(1, 1);

        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadImageAsync(1, Upload(BannerImages.Png(1920, 1080)), null, null, default));
        Assert.Empty(storage.Saved);
    }

    [Fact]
    public async Task DeletingABannerDeletesItsImages()
    {
        var banner = Seed(1, 1, image: "https://blob/home-banners/1/a.webp");
        banner.ImageUrl1280 = "https://blob/home-banners/1/a-1280.webp";
        db.SaveChanges();

        await service.DeleteAsync(1, default);

        Assert.Empty(db.Set<Banner>());
        Assert.Equal(["https://blob/home-banners/1/a.webp", "https://blob/home-banners/1/a-1280.webp"], storage.Deleted);
    }

    private static BannerImageUpload Upload(byte[] bytes) => new(new MemoryStream(bytes), bytes.Length);

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;
    }

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

        public Task DeleteByUrlAsync(string url, CancellationToken cancellationToken)
        {
            Deleted.Add(url);
            return Task.CompletedTask;
        }
    }
}
