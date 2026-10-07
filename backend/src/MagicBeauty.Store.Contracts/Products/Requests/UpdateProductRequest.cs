namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>
/// No expone Reference: es inmutable despues de crear el producto.
/// </summary>
public sealed class UpdateProductRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int BrandId { get; set; }

    public bool IsActive { get; set; } = true;
}
