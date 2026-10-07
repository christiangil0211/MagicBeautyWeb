namespace MagicBeauty.Store.Contracts.Products.Responses;

public sealed class InventoryMovementDto
{
    public int Id { get; set; }

    public int ProductVariantId { get; set; }

    /// <summary>INITIAL, IN, SALE_ONLINE, SALE_PHYSICAL o ADJUSTMENT.</summary>
    public string Type { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public int PreviousQuantity { get; set; }

    public int NewQuantity { get; set; }

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; }
}
