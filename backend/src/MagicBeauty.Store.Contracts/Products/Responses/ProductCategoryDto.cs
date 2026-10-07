namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class ProductCategoryDto
{
    public int CategoryId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;
}
