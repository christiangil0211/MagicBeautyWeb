using System.Text.Json;
using System.Text.RegularExpressions;

using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.HomeBanners;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Application.Features.HomeBanners;

/// <summary>
/// Banners del carrusel del inicio (Admin › Banners del inicio). La tienda solo
/// muestra los activos, con imagen y vigentes hoy, en el orden que se arrastró.
/// </summary>
public sealed partial class HomeBannerService(
    IHomeBannerRepository repository,
    IFileStorageFactory storageFactory,
    TimeProvider timeProvider,
    ILogger<HomeBannerService> logger) : IHomeBannerService
{
    public const int MaxNameLength = 60;
    public const int MaxTitleLength = 150;
    public const int MaxAltTextLength = 500;
    public const int MaxLinkLength = 300;
    public const int MaxLabelLength = 80;
    public const int MaxNoteHighlightLength = 60;
    public const int MaxNoteTextLength = 200;
    public const int MaxHotspots = 4;
    public const int MaxMobileCtas = 2;

    /// <summary>La tienda vive en Colombia (UTC-5 todo el año, sin horario de verano).</summary>
    private static readonly TimeSpan ColombiaOffset = TimeSpan.FromHours(-5);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IFileStorage storage = storageFactory.Get(FileStorageDestination.Banners);

    public async Task<IReadOnlyList<HomeBannerDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var today = Today();
        return (await repository.GetAllAsync(cancellationToken)).Select(banner => MapToDto(banner, today)).ToList();
    }

    public async Task<IReadOnlyList<PublicHomeBannerDto>> GetVisibleAsync(CancellationToken cancellationToken)
    {
        var banners = await repository.GetVisibleAsync(Today(), cancellationToken);
        return banners.Select(banner => Fill(new PublicHomeBannerDto(), banner)).ToList();
    }

    public async Task<HomeBannerDto> GetByIdAsync(int id, CancellationToken cancellationToken) =>
        MapToDto(await RequireAsync(id, cancellationToken), Today());

    public async Task<HomeBannerDto> CreateAsync(SaveHomeBannerRequest request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var banner = new Banner
        {
            SortOrder = await repository.GetMaxSortOrderAsync(cancellationToken) + 1,
            CreatedAt = now
        };

        Apply(banner, request, now);

        await repository.AddAsync(banner, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return MapToDto(banner, Today());
    }

    public async Task<HomeBannerDto> UpdateAsync(int id, SaveHomeBannerRequest request, CancellationToken cancellationToken)
    {
        var banner = await RequireAsync(id, cancellationToken);

        Apply(banner, request, DateTime.UtcNow);
        await repository.SaveChangesAsync(cancellationToken);

        return MapToDto(banner, Today());
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var banner = await RequireAsync(id, cancellationToken);
        var images = ImagesOf(banner);

        repository.Delete(banner);
        await repository.SaveChangesAsync(cancellationToken);

        await CleanupAsync(images);
    }

    public async Task<HomeBannerDto> UploadImageAsync(
        int id,
        BannerImageUpload original,
        BannerImageUpload? image768,
        BannerImageUpload? image1280,
        CancellationToken cancellationToken)
    {
        var banner = await RequireAsync(id, cancellationToken);

        // Todo se valida antes de guardar nada.
        using var originalBuffer = await ReadBoundedAsync(original, BannerImageRules.MaxOriginalBytes, "La imagen", "3 MB", cancellationToken);
        var originalImage = BannerImageRules.ValidateOriginal(Span(originalBuffer));

        using var buffer768 = image768 is null ? null : await ReadBoundedAsync(image768, BannerImageRules.MaxVariantBytes, "La copia de 768 px", "1 MB", cancellationToken);
        using var buffer1280 = image1280 is null ? null : await ReadBoundedAsync(image1280, BannerImageRules.MaxVariantBytes, "La copia de 1280 px", "1 MB", cancellationToken);
        var format768 = buffer768 is null ? null : BannerImageRules.ValidateVariant(Span(buffer768), 768).Format;
        var format1280 = buffer1280 is null ? null : BannerImageRules.ValidateVariant(Span(buffer1280), 1280).Format;

        var previous = ImagesOf(banner);
        var previousState = (banner.ImageUrl, banner.ImageWidth, banner.ImageHeight, banner.ImageUrl768, banner.ImageUrl1280, banner.UpdatedAt);
        var key = $"home-banners/{id}/{Guid.NewGuid():N}";
        var saved = new List<string>();

        try
        {
            saved.Add(await SaveAsync($"{key}{originalImage.Format.Extension}", originalBuffer, originalImage.Format, cancellationToken));
            banner.ImageUrl = saved[^1];
            banner.ImageWidth = originalImage.Width;
            banner.ImageHeight = originalImage.Height;

            banner.ImageUrl768 = null;
            if (buffer768 is not null)
            {
                saved.Add(await SaveAsync($"{key}-768{format768!.Extension}", buffer768, format768, cancellationToken));
                banner.ImageUrl768 = saved[^1];
            }

            banner.ImageUrl1280 = null;
            if (buffer1280 is not null)
            {
                saved.Add(await SaveAsync($"{key}-1280{format1280!.Extension}", buffer1280, format1280, cancellationToken));
                banner.ImageUrl1280 = saved[^1];
            }

            banner.UpdatedAt = DateTime.UtcNow;
            await repository.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // La base no cambió: los archivos nuevos sobran y el banner conserva su imagen.
            (banner.ImageUrl, banner.ImageWidth, banner.ImageHeight, banner.ImageUrl768, banner.ImageUrl1280, banner.UpdatedAt) = previousState;
            await CleanupAsync(saved);
            throw;
        }

        await CleanupAsync(previous);

        return MapToDto(banner, Today());
    }

    public async Task<IReadOnlyList<HomeBannerDto>> ReorderAsync(ReorderHomeBannersRequest request, CancellationToken cancellationToken)
    {
        var ids = request.Ids ?? [];
        var banners = await repository.GetAllAsync(cancellationToken);

        if (ids.Count != banners.Count || ids.Distinct().Count() != ids.Count || !banners.All(banner => ids.Contains(banner.Id)))
        {
            throw new ArgumentException("El orden debe incluir todos los banners una sola vez. Recarga la página e intenta de nuevo.");
        }

        var byId = banners.ToDictionary(banner => banner.Id);
        var now = DateTime.UtcNow;

        for (var index = 0; index < ids.Count; index++)
        {
            var banner = byId[ids[index]];

            if (banner.SortOrder != index + 1)
            {
                banner.SortOrder = index + 1;
                banner.UpdatedAt = now;
            }
        }

        await repository.SaveChangesAsync(cancellationToken);

        return await GetAllAsync(cancellationToken);
    }

    /// <summary>Fecha de hoy en Colombia: la que rige la vigencia.</summary>
    public DateOnly Today() => DateOnly.FromDateTime(timeProvider.GetUtcNow().ToOffset(ColombiaOffset).DateTime);

    public static bool IsVisibleOn(Banner banner, DateOnly today) =>
        banner.IsActive
        && !string.IsNullOrWhiteSpace(banner.ImageUrl)
        && (banner.StartsOn is null || banner.StartsOn <= today)
        && (banner.EndsOn is null || today <= banner.EndsOn);

    private static void Apply(Banner banner, SaveHomeBannerRequest request, DateTime now)
    {
        banner.Name = Required(request.Name, MaxNameLength, "El nombre corto");
        banner.Title = Required(request.Title, MaxTitleLength, "El título");
        banner.AltText = Required(request.AltText, MaxAltTextLength, "El texto alternativo");

        var link = request.Link is null || string.IsNullOrWhiteSpace(request.Link.Link) ? null : ValidateLink(request.Link, "El enlace del banner");
        var hotspots = (request.Hotspots ?? []).Select(ValidateHotspot).ToList();
        var ctas = (request.MobileCtas ?? []).Select((cta, index) => ValidateLink(cta, $"El botón para celular {index + 1}")).ToList();

        if (hotspots.Count > MaxHotspots)
        {
            throw new ArgumentException($"Un banner admite como máximo {MaxHotspots} zonas clicables.");
        }

        if (ctas.Count > MaxMobileCtas)
        {
            throw new ArgumentException($"Un banner admite como máximo {MaxMobileCtas} botones para celular.");
        }

        // Si toda la imagen enlaza, las zonas quedarían dentro de otro enlace.
        if (link is not null && hotspots.Count > 0)
        {
            throw new ArgumentException("Usa un enlace para toda la imagen o zonas clicables sobre sus botones, no ambos.");
        }

        banner.LinkUrl = link?.Link;
        banner.LinkLabel = link?.Label;
        banner.HotspotsJson = hotspots.Count == 0 ? null : JsonSerializer.Serialize(hotspots, Json);
        banner.MobileCtasJson = ctas.Count == 0 ? null : JsonSerializer.Serialize(ctas, Json);

        banner.NoteHighlight = Optional(request.NoteHighlight, MaxNoteHighlightLength, "La parte destacada del aviso");
        banner.NoteText = Optional(request.NoteText, MaxNoteTextLength, "El aviso bajo la imagen");

        if (request.StartsOn is { } starts && request.EndsOn is { } ends && ends < starts)
        {
            throw new ArgumentException("La fecha final no puede ser anterior a la inicial.");
        }

        banner.StartsOn = request.StartsOn;
        banner.EndsOn = request.EndsOn;
        banner.IsActive = request.IsActive;
        banner.UpdatedAt = now;
    }

    private static HomeBannerLinkDto ValidateLink(HomeBannerLinkDto link, string subject)
    {
        var label = Required(link.Label, MaxLabelLength, $"{subject}: el texto");
        var path = link.Link?.Trim() ?? string.Empty;

        if (path.Length == 0)
        {
            throw new ArgumentException($"{subject}: falta la ruta.");
        }

        if (path.Length > MaxLinkLength || !InternalPath().IsMatch(path))
        {
            throw new ArgumentException($"{subject}: la ruta debe ser una página de la tienda que empiece por \"/\" (por ejemplo /catalogo).");
        }

        return new HomeBannerLinkDto { Label = label, Link = path };
    }

    private static HomeBannerHotspotDto ValidateHotspot(HomeBannerHotspotDto spot, int index)
    {
        var link = ValidateLink(new HomeBannerLinkDto { Label = spot.Label, Link = spot.Link }, $"La zona {index + 1}");

        if (spot.Left < 0 || spot.Top < 0 || spot.Width < 1 || spot.Height < 1 || spot.Left + spot.Width > 100.5m || spot.Top + spot.Height > 100.5m)
        {
            throw new ArgumentException($"La zona {index + 1} debe quedar dentro de la imagen y medir al menos 1 %.");
        }

        return new HomeBannerHotspotDto
        {
            Label = link.Label,
            Link = link.Link,
            Left = Math.Round(spot.Left, 2),
            Top = Math.Round(spot.Top, 2),
            Width = Math.Round(Math.Min(spot.Width, 100 - spot.Left), 2),
            Height = Math.Round(Math.Min(spot.Height, 100 - spot.Top), 2)
        };
    }

    private static string Required(string? value, int maxLength, string subject)
    {
        var text = Clean(value);

        if (text.Length == 0)
        {
            throw new ArgumentException($"{subject} es obligatorio.");
        }

        return text.Length > maxLength ? throw new ArgumentException($"{subject} admite como máximo {maxLength} caracteres.") : text;
    }

    private static string? Optional(string? value, int maxLength, string subject)
    {
        var text = Clean(value);

        if (text.Length == 0)
        {
            return null;
        }

        return text.Length > maxLength ? throw new ArgumentException($"{subject} admite como máximo {maxLength} caracteres.") : text;
    }

    private static string Clean(string? value) => Whitespace().Replace(value ?? string.Empty, " ").Trim();

    /// <summary>
    /// Copia el archivo a memoria sin pasar del límite, aunque el cliente informe mal
    /// el tamaño.
    /// </summary>
    private static async Task<MemoryStream> ReadBoundedAsync(
        BannerImageUpload upload,
        long maxBytes,
        string subject,
        string maxLabel,
        CancellationToken cancellationToken)
    {
        if (upload.Length <= 0 || upload.Length > maxBytes)
        {
            throw new ArgumentException($"{subject} debe pesar como máximo {maxLabel}.");
        }

        var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int count;

        while ((count = await upload.Content.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + count > maxBytes)
            {
                await buffer.DisposeAsync();
                throw new ArgumentException($"{subject} debe pesar como máximo {maxLabel}.");
            }

            await buffer.WriteAsync(chunk.AsMemory(0, count), cancellationToken);
        }

        return buffer;
    }

    private static ReadOnlySpan<byte> Span(MemoryStream buffer) => buffer.GetBuffer().AsSpan(0, (int)buffer.Length);

    private Task<string> SaveAsync(string path, MemoryStream buffer, ImageUploadRules.ImageFormat format, CancellationToken cancellationToken)
    {
        buffer.Position = 0;
        return storage.SaveAsync(path, buffer, format.ContentType, cancellationToken);
    }

    private async Task<Banner> RequireAsync(int id, CancellationToken cancellationToken) =>
        await repository.GetByIdAsync(id, cancellationToken) ?? throw new KeyNotFoundException("El banner no existe.");

    private static List<string> ImagesOf(Banner banner) =>
        new[] { banner.ImageUrl, banner.ImageUrl768, banner.ImageUrl1280 }.OfType<string>().ToList();

    /// <summary>
    /// Borra archivos que ya no usa nadie. Las rutas propias de la tienda
    /// (/images/campaigns/…) no son del almacenamiento y se ignoran.
    /// </summary>
    private async Task CleanupAsync(IEnumerable<string> urls)
    {
        foreach (var url in urls.Where(url => !string.IsNullOrWhiteSpace(url)))
        {
            try
            {
                await storage.DeleteByUrlAsync(url, CancellationToken.None);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "No se pudo borrar la imagen de banner {ImageUrl}; requiere limpieza manual.", url);
            }
        }
    }

    private static HomeBannerDto MapToDto(Banner banner, DateOnly today)
    {
        var dto = Fill(new HomeBannerDto(), banner);
        dto.StartsOn = banner.StartsOn;
        dto.EndsOn = banner.EndsOn;
        dto.SortOrder = banner.SortOrder;
        dto.IsActive = banner.IsActive;
        dto.IsVisibleToday = IsVisibleOn(banner, today);
        dto.CreatedAt = banner.CreatedAt;
        dto.UpdatedAt = banner.UpdatedAt;
        return dto;
    }

    private static T Fill<T>(T dto, Banner banner) where T : PublicHomeBannerDto
    {
        dto.Id = banner.Id;
        dto.Name = banner.Name;
        dto.Title = banner.Title;
        dto.AltText = banner.AltText;
        dto.ImageUrl = banner.ImageUrl;
        dto.ImageWidth = banner.ImageWidth;
        dto.ImageHeight = banner.ImageHeight;
        dto.ImageUrl768 = banner.ImageUrl768;
        dto.ImageUrl1280 = banner.ImageUrl1280;
        dto.Link = banner.LinkUrl is null ? null : new HomeBannerLinkDto { Label = banner.LinkLabel ?? banner.Title, Link = banner.LinkUrl };
        dto.Hotspots = Deserialize<HomeBannerHotspotDto>(banner.HotspotsJson);
        dto.MobileCtas = Deserialize<HomeBannerLinkDto>(banner.MobileCtasJson);
        dto.NoteHighlight = banner.NoteHighlight;
        dto.NoteText = banner.NoteText;
        return dto;
    }

    private static List<T> Deserialize<T>(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<List<T>>(json, Json) ?? [];

    /// <summary>Ruta interna: "/" seguido de letras, números y signos de URL; nunca "//" (otro sitio).</summary>
    [GeneratedRegex(@"^/(?![/\\])[A-Za-z0-9\-._~/?#=&%+]*$")]
    private static partial Regex InternalPath();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
