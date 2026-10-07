namespace MagicBeauty.Store.Contracts.Brands.Requests;

public sealed class CreateBrandRequest
{
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
