namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class ProductPriceDto
{
    public int Id { get; set; }

    public int PriceTypeId { get; set; }

    public string PriceTypeCode { get; set; } = string.Empty;

    public string PriceTypeName { get; set; } = string.Empty;

    public bool IsDefaultPriceType { get; set; }

    public decimal Amount { get; set; }

    public bool IsActive { get; set; }
}
