namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class UpdateProductImageRequest
{
    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public int? ProductVariantId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsMain { get; set; }

    public bool IsActive { get; set; } = true;
}
