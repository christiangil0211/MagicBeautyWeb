namespace MagicBeauty.Store.Application.Features.Products;

/// <summary>Archivo de imagen recibido por la capa web, ya sin tipos de ASP.NET Core.</summary>
public sealed record ProductImageUpload(
    Stream Content,
    long Length,
    string? AltText,
    int? ProductVariantId,
    int DisplayOrder,
    bool IsMain);
