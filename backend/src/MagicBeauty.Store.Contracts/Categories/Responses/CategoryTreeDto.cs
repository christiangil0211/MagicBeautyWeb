namespace MagicBeauty.Store.Contracts.Categories.Responses;

public sealed class CategoryTreeDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public int? ParentCategoryId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public bool ShowInNavigation { get; set; }

    public bool ShowInHome { get; set; }

    public bool ShowInMegaMenu { get; set; }

    public List<CategoryTreeDto> Children { get; set; } = [];
}