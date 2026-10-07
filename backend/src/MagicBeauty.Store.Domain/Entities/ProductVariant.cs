namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Tono o presentacion seleccionable de un producto. Es tambien la unidad de
/// inventario: la cantidad vive siempre aqui, tenga o no el producto tonos visibles.
/// </summary>
public sealed class ProductVariant
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product? Product { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? ColorHex { get; set; }

    /// <summary>
    /// Existencias disponibles. Nunca se modifica desde el update normal de la
    /// variante: solo a traves de la operacion de inventario, que ademas registra
    /// el movimiento correspondiente.
    /// </summary>
    public int Quantity { get; set; }

    public int DisplayOrder { get; set; }

    /// <summary>
    /// Variante interna de los productos sin tonos. No se expone al consumidor.
    /// </summary>
    public bool IsDefault { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Evita que dos ventas simultaneas dejen el inventario en negativo.</summary>
    public byte[] RowVersion { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();

    public ICollection<InventoryMovement> Movements { get; set; } = new List<InventoryMovement>();
}
