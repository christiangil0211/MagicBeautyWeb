namespace MagicBeauty.Store.Contracts.Categories.Requests;

public sealed class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Slug { get; set; } = string.Empty;

    public int? ParentCategoryId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public string? ImageUrl { get; set; }

    public string? HomeImageUrl { get; set; }

    public string? IconUrl { get; set; }

    public bool ShowInHome { get; set; }

    public bool ShowInNavigation { get; set; } = true;

    public bool ShowInMegaMenu { get; set; }
}