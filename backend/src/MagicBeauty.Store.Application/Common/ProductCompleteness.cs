using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common;

/// <summary>
/// Ficha completa = activa, con al menos una foto activa y precio al detal mayor
/// que cero. Es el criterio del sitemap, de las páginas de marca y de isCompleteProduct
/// en el frontend: solo las completas se ofrecen a los buscadores.
/// </summary>
public static class ProductCompleteness
{
    /// <summary>Tipo de precio público (Detal), sembrado en PriceTypeConfiguration.</summary>
    public const string RetailPriceTypeCode = "RETAIL";

    /// <summary>Requiere Images y Prices (con PriceType) cargados.</summary>
    public static bool IsComplete(Product product) =>
        product.IsActive &&
        product.Images.Any(image => image.IsActive) &&
        product.Prices.Any(price =>
            price.IsActive && price.Amount > 0 && price.PriceType is not null && price.PriceType.Code == RetailPriceTypeCode);
}
