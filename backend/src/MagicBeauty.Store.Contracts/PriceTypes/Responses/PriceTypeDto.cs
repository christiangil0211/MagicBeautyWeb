namespace MagicBeauty.Store.Contracts.PriceTypes.Responses;

public sealed class PriceTypeDto
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Precio de referencia obligatorio en todo producto.</summary>
    public bool IsDefault { get; set; }

    /// <summary>Visible para usuarios no autenticados.</summary>
    public bool IsPublic { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }
}
