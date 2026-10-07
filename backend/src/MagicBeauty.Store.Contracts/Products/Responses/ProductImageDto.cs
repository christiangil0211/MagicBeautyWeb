namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class ProductImageDto
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public int? ProductVariantId { get; set; }

    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsMain { get; set; }

    public bool IsActive { get; set; }
}
