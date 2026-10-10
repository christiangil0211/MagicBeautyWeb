using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
namespace MagicBeauty.Store.Infrastructure.Storage;

public sealed class FileStorageFactory : IFileStorageFactory
{
    private readonly IFileStorage products;
    private readonly IFileStorage categories;
    private readonly IFileStorage catalogs;
    public FileStorageFactory(IFileStorage products, AzureBlobStorageOptions azure, LocalFileStorageOptions? local, ILogger<AzureBlobFileStorage> logger)
    {
        this.products = products;
        if (azure.IsConfigured)
        {
            if (string.IsNullOrWhiteSpace(azure.CategoryContainerName) || azure.CategoryContainerName == azure.ContainerName) throw new InvalidOperationException("Categories requiere un contenedor separado de Products.");
            if (string.IsNullOrWhiteSpace(azure.CatalogContainerName) || azure.CatalogContainerName == azure.ContainerName || azure.CatalogContainerName == azure.CategoryContainerName) throw new InvalidOperationException("Catalogs requiere un contenedor separado de Products y Categories.");
            categories = ForContainer(azure, azure.CategoryContainerName, azure.CategoryPublicBaseUrl, logger);
            catalogs = ForContainer(azure, azure.CatalogContainerName, azure.CatalogPublicBaseUrl, logger);
        }
        else
        {
            categories = local is null ? new UnconfiguredFileStorage() : new LocalFileStorage(local);
            catalogs = categories;
        }
    }
    public IFileStorage Get(FileStorageDestination destination) => destination switch { FileStorageDestination.Products => products, FileStorageDestination.Categories => categories, FileStorageDestination.Catalogs => catalogs, _ => throw new ArgumentOutOfRangeException(nameof(destination)) };

    private static AzureBlobFileStorage ForContainer(AzureBlobStorageOptions azure, string containerName, string? publicBaseUrl, ILogger<AzureBlobFileStorage> logger)
        => new(new AzureBlobStorageOptions { ServiceUri = azure.ServiceUri, ConnectionString = azure.ConnectionString, ContainerName = containerName, PublicBaseUrl = publicBaseUrl }, logger);
}
