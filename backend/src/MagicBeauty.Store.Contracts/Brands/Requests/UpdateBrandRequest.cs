namespace MagicBeauty.Store.Contracts.Brands.Requests;

public sealed class UpdateBrandRequest
{
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
