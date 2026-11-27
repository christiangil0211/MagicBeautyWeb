namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>Quita una categoria de varios productos sin tocar las demas que tengan.</summary>
public sealed class UnassignCategoryFromProductsRequest
{
    public int CategoryId { get; set; }

    public List<int> ProductIds { get; set; } = [];
}
