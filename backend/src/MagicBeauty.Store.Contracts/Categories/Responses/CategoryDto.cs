namespace MagicBeauty.Store.Contracts.Categories.Responses;

public sealed class CategoryDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Slug { get; set; } = string.Empty;

    public int? ParentCategoryId { get; set; }

    public string? ParentCategoryName { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public string? ImageUrl { get; set; }

    public string? HomeImageUrl { get; set; }

    public string? IconUrl { get; set; }

    public bool ShowInHome { get; set; }

    public bool ShowInNavigation { get; set; }

    public bool ShowInMegaMenu { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}