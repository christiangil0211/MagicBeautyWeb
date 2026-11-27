using MagicBeauty.Store.Contracts.HomeBanners;

namespace MagicBeauty.Store.Application.Features.HomeBanners;

/// <summary>Un archivo recibido: su contenido y el tamaño que informó el cliente.</summary>
public sealed record BannerImageUpload(Stream Content, long Length);

public interface IHomeBannerService
{
    /// <summary>Administrador: todos, en el orden del carrusel.</summary>
    Task<IReadOnlyList<HomeBannerDto>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Tienda: los que se ven hoy (activos, con imagen y vigentes), en orden.</summary>
    Task<IReadOnlyList<PublicHomeBannerDto>> GetVisibleAsync(CancellationToken cancellationToken);

    Task<HomeBannerDto> GetByIdAsync(int id, CancellationToken cancellationToken);

    /// <summary>Lo crea al final del carrusel.</summary>
    Task<HomeBannerDto> CreateAsync(SaveHomeBannerRequest request, CancellationToken cancellationToken);

    Task<HomeBannerDto> UpdateAsync(int id, SaveHomeBannerRequest request, CancellationToken cancellationToken);

    /// <summary>También borra sus imágenes del almacenamiento.</summary>
    Task DeleteAsync(int id, CancellationToken cancellationToken);

    /// <summary>
    /// Reemplaza la imagen. Las copias de 768 y 1280 px son opcionales; sin ellas la
    /// tienda usa la original en todos los tamaños.
    /// </summary>
    Task<HomeBannerDto> UploadImageAsync(
        int id,
        BannerImageUpload original,
        BannerImageUpload? image768,
        BannerImageUpload? image1280,
        CancellationToken cancellationToken);

    /// <summary>Nuevo orden: deben venir todos los banners, cada uno una vez.</summary>
    Task<IReadOnlyList<HomeBannerDto>> ReorderAsync(ReorderHomeBannersRequest request, CancellationToken cancellationToken);
}
