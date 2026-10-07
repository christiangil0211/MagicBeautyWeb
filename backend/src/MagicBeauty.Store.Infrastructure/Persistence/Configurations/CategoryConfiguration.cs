using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");

        builder.HasKey(category => category.Id);

        builder.Property(category => category.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(category => category.Description)
            .HasMaxLength(500);

        builder.Property(category => category.Slug)
            .HasMaxLength(180)
            .IsRequired();

        builder.HasIndex(category => category.Slug)
            .IsUnique();

        builder.Property(category => category.ImageUrl)
            .HasMaxLength(500);

        builder.Property(category => category.HomeImageUrl)
            .HasMaxLength(500);

        builder.Property(category => category.IconUrl)
            .HasMaxLength(500);

        builder.Property(category => category.CreatedAt)
            .IsRequired();

        builder.Property(category => category.UpdatedAt)
            .IsRequired();

        builder.HasOne(category => category.ParentCategory)
            .WithMany(category => category.Children)
            .HasForeignKey(category => category.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}