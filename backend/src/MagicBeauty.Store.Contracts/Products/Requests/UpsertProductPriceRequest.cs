namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class UpsertProductPriceRequest
{
    public int PriceTypeId { get; set; }

    public decimal Amount { get; set; }

    public bool IsActive { get; set; } = true;
}
