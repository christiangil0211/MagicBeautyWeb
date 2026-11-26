namespace MagicBeauty.Store.Application.Common;

public static class ProductFilters
{
    /// <summary>
    /// Valor de brandId que pide los productos SIN marca (BrandId NULL). Los Id de
    /// marca empiezan en 1, así que 0 nunca es una marca real.
    /// </summary>
    public const int WithoutBrand = 0;
}
