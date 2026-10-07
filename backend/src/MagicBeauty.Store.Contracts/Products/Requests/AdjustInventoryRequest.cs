namespace MagicBeauty.Store.Contracts.Products.Requests;

public sealed class AdjustInventoryRequest
{
    /// <summary>IN, SALE_ONLINE, SALE_PHYSICAL o ADJUSTMENT. INITIAL lo genera solo el sistema.</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Magnitud del movimiento. IN y las ventas exigen un valor positivo y el tipo
    /// decide el signo; ADJUSTMENT admite valores negativos para corregir a la baja.
    /// </summary>
    public int Quantity { get; set; }

    public string? Reason { get; set; }
}
