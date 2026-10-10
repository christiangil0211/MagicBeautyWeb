using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Responses;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Application.Features.TraditionalCatalogs;

/// <summary>
/// Catalogos tradicionales (Canva + PDF). Sigue el patron de las imagenes de
/// categoria: el archivo nuevo se guarda, se confirma en base de datos y solo
/// entonces se borra el anterior; si la base falla, se limpia el nuevo.
/// </summary>
public sealed class TraditionalCatalogService(
    ITraditionalCatalogRepository repository,
    IFileStorageFactory storageFactory,
    ICanvaLinkInspector canvaLinkInspector,
    ILogger<TraditionalCatalogService> logger) : ITraditionalCatalogService
{
    private const int MaxNameLength = 150;
    private const int CopyBufferSize = 81920;

    private readonly IFileStorage storage = storageFactory.Get(FileStorageDestination.Catalogs);

    private enum CatalogFile { Cover, Pdf }

    public async Task<IReadOnlyList<PublicTraditionalCatalogDto>> GetPublicAsync(CancellationToken cancellationToken)
    {
        var catalogs = await repository.GetActiveAsync(cancellationToken);

        return catalogs
            .Select(catalog => new PublicTraditionalCatalogDto
            {
                Id = catalog.Id,
                Name = catalog.Name,
                CanvaEmbedUrl = catalog.CanvaEmbedUrl,
                CanvaShareUrl = catalog.CanvaShareUrl,
                CanvaEmbeddable = catalog.CanvaEmbeddable,
                CoverImageUrl = catalog.CoverImageUrl,
                PdfUrl = catalog.PdfUrl
            })
            .ToList();
    }

    public async Task<IReadOnlyList<TraditionalCatalogDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var catalogs = await repository.GetAllAsync(cancellationToken);

        return catalogs.Select(MapToDto).ToList();
    }

    public async Task<TraditionalCatalogDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return MapToDto(await GetRequiredAsync(id, cancellationToken));
    }

    public async Task<TraditionalCatalogDto> CreateAsync(
        CreateTraditionalCatalogRequest request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        var name = ValidateName(request.Name);
        var canva = await InspectCanvaUrlAsync(request.CanvaUrl, cancellationToken);

        var catalog = new TraditionalCatalog
        {
            Name = name,
            CanvaEmbedUrl = canva.EmbedUrl,
            CanvaShareUrl = canva.ShareUrl,
            CanvaEmbeddable = canva.Embeddable,
            DisplayOrder = ValidateDisplayOrder(request.DisplayOrder),
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        await repository.AddAsync(catalog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return MapToDto(catalog);
    }

    public async Task UpdateAsync(
        int id,
        UpdateTraditionalCatalogRequest request,
        CancellationToken cancellationToken)
    {
        var catalog = await GetRequiredAsync(id, cancellationToken);

        catalog.Name = ValidateName(request.Name);

        // Siempre se vuelve a consultar: si en Canva se habilito la insercion, guardar la activa.
        var canva = await InspectCanvaUrlAsync(request.CanvaUrl, cancellationToken);
        catalog.CanvaEmbedUrl = canva.EmbedUrl;
        catalog.CanvaShareUrl = canva.ShareUrl;
        catalog.CanvaEmbeddable = canva.Embeddable;

        catalog.DisplayOrder = ValidateDisplayOrder(request.DisplayOrder);
        catalog.IsActive = request.IsActive;
        catalog.UpdatedAt = DateTime.UtcNow;

        await repository.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var catalog = await GetRequiredAsync(id, cancellationToken);
        var files = new[] { catalog.CoverImageUrl, catalog.PdfUrl };

        repository.Delete(catalog);
        await repository.SaveChangesAsync(cancellationToken);

        foreach (var url in files)
        {
            await CleanupAsync(url);
        }
    }

    public async Task<TraditionalCatalogDto> UploadCoverAsync(
        int id,
        Stream content,
        long length,
        CancellationToken cancellationToken)
    {
        var catalog = await GetRequiredAsync(id, cancellationToken);

        if (length <= 0 || length > ImageUploadRules.MaxBytes)
        {
            throw new ArgumentException("La portada debe pesar entre 1 byte y 8 MB.");
        }

        using var buffer = new MemoryStream();
        await CopyBoundedAsync(content, buffer, ImageUploadRules.MaxBytes, "La portada supera 8 MB.", cancellationToken);

        var format = ImageUploadRules.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16)));

        return await ReplaceFileAsync(
            catalog,
            CatalogFile.Cover,
            () => storage.SaveAsync(
                $"catalogs/{id}/cover/{Guid.NewGuid():N}{format.Extension}",
                buffer,
                format.ContentType,
                cancellationToken),
            cancellationToken);
    }

    public Task<TraditionalCatalogDto> DeleteCoverAsync(int id, CancellationToken cancellationToken)
    {
        return ClearFileAsync(id, CatalogFile.Cover, cancellationToken);
    }

    public async Task<TraditionalCatalogDto> UploadPdfAsync(
        int id,
        Stream content,
        long length,
        CancellationToken cancellationToken)
    {
        var catalog = await GetRequiredAsync(id, cancellationToken);

        if (length <= 0 || length > PdfUploadRules.MaxBytes)
        {
            throw new ArgumentException("El PDF debe pesar entre 1 byte y 50 MB.");
        }

        // Un PDF puede pesar decenas de MB: se apoya en un temporal y no en memoria.
        await using var buffer = new FileStream(
            Path.GetTempFileName(),
            FileMode.Create,
            FileAccess.ReadWrite,
            FileShare.None,
            CopyBufferSize,
            FileOptions.DeleteOnClose | FileOptions.Asynchronous);

        await CopyBoundedAsync(content, buffer, PdfUploadRules.MaxBytes, "El PDF supera 50 MB.", cancellationToken);

        var header = new byte[8];
        var read = await buffer.ReadAsync(header, cancellationToken);
        PdfUploadRules.EnsurePdf(header.AsSpan(0, read));
        buffer.Position = 0;

        return await ReplaceFileAsync(
            catalog,
            CatalogFile.Pdf,
            () => storage.SaveForDownloadAsync(
                $"catalogs/{id}/pdf/{Guid.NewGuid():N}{PdfUploadRules.Extension}",
                buffer,
                PdfUploadRules.ContentType,
                BuildDownloadFileName(catalog.Name),
                cancellationToken),
            cancellationToken);
    }

    public Task<TraditionalCatalogDto> DeletePdfAsync(int id, CancellationToken cancellationToken)
    {
        return ClearFileAsync(id, CatalogFile.Pdf, cancellationToken);
    }

    private async Task<TraditionalCatalogDto> ReplaceFileAsync(
        TraditionalCatalog catalog,
        CatalogFile file,
        Func<Task<string>> save,
        CancellationToken cancellationToken)
    {
        var previous = GetFile(catalog, file);
        var previousUpdatedAt = catalog.UpdatedAt;
        var url = await save();

        SetFile(catalog, file, url);
        catalog.UpdatedAt = DateTime.UtcNow;

        try
        {
            await repository.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            SetFile(catalog, file, previous);
            catalog.UpdatedAt = previousUpdatedAt;
            await CleanupAsync(url);
            throw;
        }

        await CleanupAsync(previous);

        return MapToDto(catalog);
    }

    private async Task<TraditionalCatalogDto> ClearFileAsync(
        int id,
        CatalogFile file,
        CancellationToken cancellationToken)
    {
        var catalog = await GetRequiredAsync(id, cancellationToken);
        var previous = GetFile(catalog, file);
        var previousUpdatedAt = catalog.UpdatedAt;

        SetFile(catalog, file, null);
        catalog.UpdatedAt = DateTime.UtcNow;

        try
        {
            await repository.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            SetFile(catalog, file, previous);
            catalog.UpdatedAt = previousUpdatedAt;
            throw;
        }

        await CleanupAsync(previous);

        return MapToDto(catalog);
    }

    private async Task<TraditionalCatalog> GetRequiredAsync(int id, CancellationToken cancellationToken)
    {
        return await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("El catálogo no existe.");
    }

    /// <summary>El archivo huerfano no rompe la operacion: queda en el log para limpiarlo.</summary>
    private async Task CleanupAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            await storage.DeleteByUrlAsync(url, CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "No se pudo borrar el archivo de catálogo {FileUrl}; requiere limpieza manual.", url);
        }
    }

    /// <summary>Copia sin superar el limite aunque el cliente informe mal la longitud.</summary>
    private static async Task CopyBoundedAsync(
        Stream source,
        Stream destination,
        long maxBytes,
        string tooLargeMessage,
        CancellationToken cancellationToken)
    {
        var chunk = new byte[CopyBufferSize];
        int count;

        while ((count = await source.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (destination.Length + count > maxBytes)
            {
                throw new ArgumentException(tooLargeMessage);
            }

            await destination.WriteAsync(chunk.AsMemory(0, count), cancellationToken);
        }

        destination.Position = 0;
    }

    private sealed record CanvaLink(string ShareUrl, string EmbedUrl, bool Embeddable);

    /// <summary>
    /// Del enlace compartido se obtiene la URL de insercion (un canva.link se resuelve
    /// antes) y se pregunta a Canva si se puede mostrar en la tienda. Si no, el
    /// catalogo se abrira directamente en Canva con el enlace compartido.
    /// </summary>
    private async Task<CanvaLink> InspectCanvaUrlAsync(string? input, CancellationToken cancellationToken)
    {
        var shareUrl = CanvaEmbedUrl.ExtractShareUrl(input);
        var designUrl = shareUrl;

        if (CanvaEmbedUrl.TryGetShortLink(shareUrl, out var shortLink))
        {
            designUrl = await canvaLinkInspector.ResolveAsync(shortLink, cancellationToken)
                ?? throw new ArgumentException(
                    "No pudimos abrir el enlace corto de Canva. Revisa que el enlace funcione o pega el enlace completo del diseno.");
        }

        var embedUrl = CanvaEmbedUrl.Normalize(designUrl);
        var embeddable = await canvaLinkInspector.IsEmbeddableAsync(new Uri(embedUrl), cancellationToken);

        return new CanvaLink(shareUrl, embedUrl, embeddable);
    }

    private static string ValidateName(string? name)
    {
        var value = name?.Trim() ?? string.Empty;

        if (value.Length == 0)
        {
            throw new ArgumentException("El nombre del catálogo es obligatorio.");
        }

        if (value.Length > MaxNameLength)
        {
            throw new ArgumentException($"El nombre del catálogo admite máximo {MaxNameLength} caracteres.");
        }

        return value;
    }

    private static int ValidateDisplayOrder(int displayOrder)
    {
        return displayOrder < 0
            ? throw new ArgumentException("El orden no puede ser negativo.")
            : displayOrder;
    }

    /// <summary>Nombre con el que se descarga el PDF: el del catalogo, sin caracteres de ruta.</summary>
    private static string BuildDownloadFileName(string catalogName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var safe = new string(catalogName.Select(ch => invalid.Contains(ch) ? '-' : ch).ToArray()).Trim();

        return (safe.Length == 0 ? "catalogo" : safe) + PdfUploadRules.Extension;
    }

    private static string? GetFile(TraditionalCatalog catalog, CatalogFile file) =>
        file == CatalogFile.Cover ? catalog.CoverImageUrl : catalog.PdfUrl;

    private static void SetFile(TraditionalCatalog catalog, CatalogFile file, string? url)
    {
        if (file == CatalogFile.Cover)
        {
            catalog.CoverImageUrl = url;
        }
        else
        {
            catalog.PdfUrl = url;
        }
    }

    private static TraditionalCatalogDto MapToDto(TraditionalCatalog catalog)
    {
        return new TraditionalCatalogDto
        {
            Id = catalog.Id,
            Name = catalog.Name,
            CanvaEmbedUrl = catalog.CanvaEmbedUrl,
            CanvaShareUrl = catalog.CanvaShareUrl,
            CanvaEmbeddable = catalog.CanvaEmbeddable,
            CoverImageUrl = catalog.CoverImageUrl,
            PdfUrl = catalog.PdfUrl,
            DisplayOrder = catalog.DisplayOrder,
            IsActive = catalog.IsActive,
            CreatedAt = catalog.CreatedAt,
            UpdatedAt = catalog.UpdatedAt
        };
    }
}
