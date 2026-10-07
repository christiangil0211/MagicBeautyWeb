using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class ProductCategoryConfiguration : IEntityTypeConfiguration<ProductCategory>
{
    public void Configure(EntityTypeBuilder<ProductCategory> builder)
    {
        builder.ToTable("ProductCategories");

        builder.HasKey(link => new { link.ProductId, link.CategoryId });

        builder.HasOne(link => link.Product)
            .WithMany(product => product.ProductCategories)
            .HasForeignKey(link => link.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict es lo que hace que HasProductsAsync de Category proteja de verdad.
        builder.HasOne(link => link.Category)
            .WithMany()
            .HasForeignKey(link => link.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
