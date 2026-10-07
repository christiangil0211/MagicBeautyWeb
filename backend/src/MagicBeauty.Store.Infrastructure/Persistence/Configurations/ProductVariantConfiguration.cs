using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        // Red de seguridad: la validacion legible vive en Application, pero la
        // cantidad no puede quedar negativa ni por error de codigo.
        builder.ToTable("ProductVariants", table => table.HasCheckConstraint(
            "CK_ProductVariants_Quantity_NotNegative",
            "[Quantity] >= 0"));

        builder.HasKey(variant => variant.Id);

        builder.Property(variant => variant.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(variant => variant.Code)
            .HasMaxLength(50);

        builder.Property(variant => variant.ColorHex)
            .HasMaxLength(7);

        builder.Property(variant => variant.RowVersion)
            .IsRowVersion();

        builder.Property(variant => variant.CreatedAt)
            .IsRequired();

        builder.Property(variant => variant.UpdatedAt)
            .IsRequired();

        // Como mucho una variante interna por producto.
        builder.HasIndex(variant => new { variant.ProductId, variant.IsDefault })
            .IsUnique()
            .HasFilter("[IsDefault] = 1")
            .HasDatabaseName("UX_ProductVariants_DefaultByProduct");

        builder.HasIndex(variant => new { variant.ProductId, variant.DisplayOrder });

        builder.HasOne(variant => variant.Product)
            .WithMany(product => product.Variants)
            .HasForeignKey(variant => variant.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
