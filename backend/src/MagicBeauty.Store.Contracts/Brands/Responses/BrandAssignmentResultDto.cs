namespace MagicBeauty.Store.Contracts.Brands.Responses;

public sealed class BrandAssignmentResultDto
{
    public int UpdatedCount { get; set; }
}

/// <summary>Producto que ya tiene otra marca: se movería si se confirma.</summary>
public sealed class BrandAssignmentConflictDto
{
    public int ProductId { get; set; }

    public string Reference { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int CurrentBrandId { get; set; }

    public string CurrentBrandName { get; set; } = string.Empty;
}
