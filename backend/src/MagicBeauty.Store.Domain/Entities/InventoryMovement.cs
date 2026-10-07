using MagicBeauty.Store.Domain.Enums;

namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Trazabilidad minima de los cambios de cantidad. No es un kardex contable:
/// solo deja constancia de cuanto habia, cuanto se movio y cuanto quedo.
/// </summary>
public sealed class InventoryMovement
{
    public int Id { get; set; }

    public int ProductVariantId { get; set; }

    public ProductVariant? ProductVariant { get; set; }

    public InventoryMovementType Type { get; set; }

    /// <summary>
    /// Delta con signo realmente aplicado, de modo que siempre se cumple
    /// PreviousQuantity + Quantity == NewQuantity.
    /// </summary>
    public int Quantity { get; set; }

    public int PreviousQuantity { get; set; }

    public int NewQuantity { get; set; }

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; }
}
