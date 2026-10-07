namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class ProductVariantDto
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? ColorHex { get; set; }

    public int Quantity { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsDefault { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
