namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class CreateProductVariantRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? ColorHex { get; set; }

    /// <summary>Existencias iniciales. Si es mayor que cero se registra un movimiento INITIAL.</summary>
    public int Quantity { get; set; }

    public int DisplayOrder { get; set; }
}
