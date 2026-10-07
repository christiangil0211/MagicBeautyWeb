namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class CreateProductImageRequest
{
    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    /// <summary>Null para una imagen general del producto.</summary>
    public int? ProductVariantId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsMain { get; set; }

    public bool IsActive { get; set; } = true;
}
