namespace MagicBeauty.Store.Contracts.Catalog.Responses;

/// <summary>
/// Precio que la audiencia actual tiene autorizado ver. La lista llega ya filtrada
/// y ordenada: el cliente solo la pinta.
/// </summary>
public sealed class CatalogPriceDto
{
    public string PriceTypeCode { get; set; } = string.Empty;

    public string PriceTypeName { get; set; } = string.Empty;

    public decimal Amount { get; set; }
}
