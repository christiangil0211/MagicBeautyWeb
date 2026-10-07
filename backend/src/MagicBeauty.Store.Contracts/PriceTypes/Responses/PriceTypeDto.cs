namespace MagicBeauty.Store.Contracts.PriceTypes.Responses;

public sealed class PriceTypeDto
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsDefault { get; set; }

    public bool IsActive { get; set; }
}
