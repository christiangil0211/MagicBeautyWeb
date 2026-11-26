namespace MagicBeauty.Store.Contracts.Brands.Requests;

public sealed class RemoveBrandProductsRequest
{
    public List<int> ProductIds { get; set; } = [];
}
