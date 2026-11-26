namespace MagicBeauty.Store.Contracts.Brands.Requests;

public sealed class CreateBrandRequest
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Opcional: si viene vacío se genera desde el nombre.</summary>
    public string? Slug { get; set; }

    public string? Description { get; set; }

    public bool IsFeatured { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
