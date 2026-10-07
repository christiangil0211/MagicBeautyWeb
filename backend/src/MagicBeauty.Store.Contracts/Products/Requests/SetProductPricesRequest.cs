namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>Reemplaza por completo los precios del producto.</summary>
public sealed class SetProductPricesRequest
{
    public List<UpsertProductPriceRequest> Prices { get; set; } = [];
}
