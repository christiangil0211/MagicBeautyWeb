using Azure;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Infrastructure.Storage;

/// <summary>
/// Azure Blob Storage. Se activa con Storage:AzureBlob:ConnectionString (local o pruebas)
/// o con Storage:AzureBlob:ServiceUri (Managed Identity, sin secretos).
/// </summary>
public sealed class AzureBlobStorageOptions
{
    public const string SectionName = "Storage:AzureBlob";

    public string? ConnectionString { get; set; }

    /// <summary>URL de la cuenta, p. ej. https://cuenta.blob.core.windows.net. Usa la identidad asignada por el sistema.</summary>
    public string? ServiceUri { get; set; }

    public string ContainerName { get; set; } = "catalogo";

    public string CategoryContainerName { get; set; } = "category-images";
    public string? CategoryPublicBaseUrl { get; set; }

    /// <summary>Portadas y PDF de los catalogos tradicionales.</summary>
    public string CatalogContainerName { get; set; } = "catalog-files";
    public string? CatalogPublicBaseUrl { get; set; }

    /// <summary>Opcional: dominio propio o CDN delante del contenedor.</summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>Si hay ConnectionString, tiene prioridad sobre ServiceUri.</summary>
    public bool UsesManagedIdentity =>
        string.IsNullOrWhiteSpace(ConnectionString) && !string.IsNullOrWhiteSpace(ServiceUri);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString) || UsesManagedIdentity;
}

/// <summary>Disco local: solo Development, mientras no se configure Azure.</summary>
public sealed class LocalFileStorageOptions
{
    public const string SectionName = "Storage:Local";

    /// <summary>Carpeta fuera del repositorio donde se guardan los archivos.</summary>
    public string RootPath { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MagicBeauty",
        "media");

    /// <summary>Ruta del API que sirve los archivos.</summary>
    public string RequestPath { get; set; } = "/media";

    /// <summary>URL absoluta con la que el navegador pide los archivos.</summary>
    public string PublicBaseUrl { get; set; } = "http://localhost:5070/media";
}

public sealed class LocalFileStorage(LocalFileStorageOptions options) : IFileStorage
{
    private readonly string root = Path.GetFullPath(options.RootPath);
    private readonly string baseUrl = options.PublicBaseUrl.TrimEnd('/') + "/";

    public async Task<string> SaveAsync(
        string path,
        Stream content,
        string contentType,
        CancellationToken cancellationToken)
    {
        var fullPath = ResolveInsideRoot(path);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var file = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write);
        await content.CopyToAsync(file, cancellationToken);

        return baseUrl + path.Replace('\\', '/');
    }

    public Task DeleteByUrlAsync(string url, CancellationToken cancellationToken)
    {
        if (url.StartsWith(baseUrl, StringComparison.OrdinalIgnoreCase))
        {
            var fullPath = ResolveInsideRoot(Uri.UnescapeDataString(url[baseUrl.Length..]));

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }

        return Task.CompletedTask;
    }

    /// <summary>Impide salir de la carpeta raiz con rutas como "../".</summary>
    private string ResolveInsideRoot(string relativePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));

        if (!fullPath.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Ruta de archivo no valida.");
        }

        return fullPath;
    }
}

public sealed class AzureBlobFileStorage(
    AzureBlobStorageOptions options,
    ILogger<AzureBlobFileStorage> logger) : IFileStorage
{
    private readonly BlobContainerClient container = options.UsesManagedIdentity
        ? new BlobContainerClient(
            new Uri(options.ServiceUri!.TrimEnd('/') + "/" + options.ContainerName),
            new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned))
        : new BlobContainerClient(options.ConnectionString, options.ContainerName);

    private readonly SemaphoreSlim containerLock = new(1, 1);

    // Con Managed Identity el contenedor es infraestructura existente: no se crea ni se cambia su acceso.
    private bool containerReady = options.UsesManagedIdentity;

    private string BaseUrl =>
        (string.IsNullOrWhiteSpace(options.PublicBaseUrl)
            ? container.Uri.ToString()
            : options.PublicBaseUrl).TrimEnd('/') + "/";

    public Task<string> SaveAsync(
        string path,
        Stream content,
        string contentType,
        CancellationToken cancellationToken)
        => UploadAsync(path, content, contentType, contentDisposition: null, cancellationToken);

    /// <summary>
    /// El blob vive en otro dominio, donde el atributo download del enlace no aplica:
    /// Content-Disposition es lo que hace que el navegador lo descargue.
    /// </summary>
    public Task<string> SaveForDownloadAsync(
        string path,
        Stream content,
        string contentType,
        string downloadFileName,
        CancellationToken cancellationToken)
        => UploadAsync(path, content, contentType, BuildAttachmentDisposition(downloadFileName), cancellationToken);

    private async Task<string> UploadAsync(
        string path,
        Stream content,
        string contentType,
        string? contentDisposition,
        CancellationToken cancellationToken)
    {
        await EnsureContainerAsync(cancellationToken);

        var blob = container.GetBlobClient(path);

        await blob.UploadAsync(
            content,
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = contentType,
                    ContentDisposition = contentDisposition,
                    // Los nombres son unicos: el navegador y la CDN pueden guardarlos sin limite.
                    CacheControl = "public, max-age=31536000, immutable"
                },
                Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All }
            },
            cancellationToken);

        return BaseUrl + path;
    }

    /// <summary>Nombre ASCII de respaldo y el original codificado (RFC 6266).</summary>
    public static string BuildAttachmentDisposition(string fileName)
    {
        var ascii = new string(fileName
            .Normalize(System.Text.NormalizationForm.FormD)
            .Where(ch => ch < 128 && ch != '"' && ch != '\\' && !char.IsControl(ch))
            .ToArray());

        if (string.IsNullOrWhiteSpace(ascii))
        {
            ascii = "archivo";
        }

        return $"attachment; filename=\"{ascii}\"; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
    }

    public async Task DeleteByUrlAsync(string url, CancellationToken cancellationToken)
    {
        if (!url.StartsWith(BaseUrl, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await container
            .GetBlobClient(Uri.UnescapeDataString(url[BaseUrl.Length..]))
            .DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Crea el contenedor con lectura publica de blobs (las imagenes del catalogo son
    /// publicas). Si la cuenta no permite acceso publico, se crea privado y se avisa:
    /// en ese caso hay que exponerlo con una CDN.
    /// </summary>
    private async Task EnsureContainerAsync(CancellationToken cancellationToken)
    {
        if (containerReady)
        {
            return;
        }

        await containerLock.WaitAsync(cancellationToken);

        try
        {
            if (containerReady)
            {
                return;
            }

            try
            {
                await container.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: cancellationToken);
            }
            catch (RequestFailedException exception) when (exception.Status is 403 or 409)
            {
                logger.LogWarning(
                    "La cuenta de almacenamiento no permite contenedores publicos; se crea '{Container}' privado. " +
                    "Configura Storage:AzureBlob:PublicBaseUrl con una CDN para servir las imagenes.",
                    options.ContainerName);

                await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);
            }

            containerReady = true;
        }
        finally
        {
            containerLock.Release();
        }
    }
}

/// <summary>Fuera de Development sin Azure configurado: falla de forma explicita.</summary>
public sealed class UnconfiguredFileStorage : IFileStorage
{
    public Task<string> SaveAsync(string path, Stream content, string contentType, CancellationToken cancellationToken)
    {
        throw new InvalidOperationException(
            "El almacenamiento de imagenes no esta configurado (Storage:AzureBlob:ServiceUri o ConnectionString).");
    }

    public Task DeleteByUrlAsync(string url, CancellationToken cancellationToken) => Task.CompletedTask;
}
