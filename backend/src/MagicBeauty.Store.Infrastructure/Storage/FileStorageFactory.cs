using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
namespace MagicBeauty.Store.Infrastructure.Storage;

public sealed class FileStorageFactory : IFileStorageFactory
{
    private readonly IFileStorage products;
    private readonly IFileStorage categories;
    public FileStorageFactory(IFileStorage products, AzureBlobStorageOptions azure, LocalFileStorageOptions? local, ILogger<AzureBlobFileStorage> logger)
    {
        this.products = products;
        if (azure.IsConfigured)
        {
            if (string.IsNullOrWhiteSpace(azure.CategoryContainerName) || azure.CategoryContainerName == azure.ContainerName) throw new InvalidOperationException("Categories requiere un contenedor separado de Products.");
            categories = new AzureBlobFileStorage(new AzureBlobStorageOptions { ServiceUri = azure.ServiceUri, ConnectionString = azure.ConnectionString, ContainerName = azure.CategoryContainerName, PublicBaseUrl = azure.CategoryPublicBaseUrl }, logger);
        }
        else categories = local is null ? new UnconfiguredFileStorage() : new LocalFileStorage(local);
    }
    public IFileStorage Get(FileStorageDestination destination) => destination switch { FileStorageDestination.Products => products, FileStorageDestination.Categories => categories, _ => throw new ArgumentOutOfRangeException(nameof(destination)) };
}
