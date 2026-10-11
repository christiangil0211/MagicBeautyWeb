namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>Agrega una categoria a varios productos sin tocar las que ya tienen.</summary>
public sealed class AssignCategoryToProductsRequest
{
    public int CategoryId { get; set; }

    public List<int> ProductIds { get; set; } = [];
}
