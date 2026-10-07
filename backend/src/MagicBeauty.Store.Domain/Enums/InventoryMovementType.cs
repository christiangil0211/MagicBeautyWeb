namespace MagicBeauty.Store.Domain.Enums;

/// <summary>
/// Motivo por el que cambia la cantidad de una variante. Se persiste como texto
/// para que la tabla de movimientos sea legible al consultarla directamente.
/// </summary>
public enum InventoryMovementType
{
    /// <summary>Carga inicial al crear la variante. Solo lo genera el sistema.</summary>
    Initial = 1,

    /// <summary>Entrada de mercancia.</summary>
    In = 2,

    /// <summary>Venta realizada en la tienda en linea.</summary>
    SaleOnline = 3,

    /// <summary>Venta realizada en el punto fisico.</summary>
    SalePhysical = 4,

    /// <summary>Correccion manual de inventario. Puede sumar o restar.</summary>
    Adjustment = 5
}
