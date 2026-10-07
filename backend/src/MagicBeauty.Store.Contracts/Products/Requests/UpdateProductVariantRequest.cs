namespace MagicBeauty.Store.Contracts.Products.Requests;

/// <summary>
/// No expone Quantity a proposito: las existencias solo cambian por la
/// operacion de inventario, que ademas deja el movimiento registrado.
/// </summary>
public sealed class UpdateProductVariantRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? ColorHex { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
