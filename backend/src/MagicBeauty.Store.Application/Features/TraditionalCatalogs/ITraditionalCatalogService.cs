using MagicBeauty.Store.Contracts.TraditionalCatalogs.Requests;
using MagicBeauty.Store.Contracts.TraditionalCatalogs.Responses;

namespace MagicBeauty.Store.Application.Features.TraditionalCatalogs;

public interface ITraditionalCatalogService
{
    /// <summary>Catalogos activos, en el orden configurado, para la tienda.</summary>
    Task<IReadOnlyList<PublicTraditionalCatalogDto>> GetPublicAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<TraditionalCatalogDto>> GetAllAsync(CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> CreateAsync(CreateTraditionalCatalogRequest request, CancellationToken cancellationToken);

    Task UpdateAsync(int id, UpdateTraditionalCatalogRequest request, CancellationToken cancellationToken);

    Task DeleteAsync(int id, CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> UploadCoverAsync(int id, Stream content, long length, CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> DeleteCoverAsync(int id, CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> UploadPdfAsync(int id, Stream content, long length, CancellationToken cancellationToken);

    Task<TraditionalCatalogDto> DeletePdfAsync(int id, CancellationToken cancellationToken);
}
