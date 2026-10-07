using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.ToTable("ProductImages");

        builder.HasKey(image => image.Id);

        // Solo URL y metadatos: los binarios no van a SQL Server.
        builder.Property(image => image.Url)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(image => image.AltText)
            .HasMaxLength(200);

        builder.Property(image => image.CreatedAt)
            .IsRequired();

        builder.Property(image => image.UpdatedAt)
            .IsRequired();

        // Una principal a nivel producto y una principal por variante.
        builder.HasIndex(image => new { image.ProductId, image.IsMain })
            .IsUnique()
            .HasFilter("[ProductVariantId] IS NULL AND [IsMain] = 1")
            .HasDatabaseName("UX_ProductImages_MainByProduct");

        builder.HasIndex(image => new { image.ProductVariantId, image.IsMain })
            .IsUnique()
            .HasFilter("[ProductVariantId] IS NOT NULL AND [IsMain] = 1")
            .HasDatabaseName("UX_ProductImages_MainByVariant");

        builder.HasOne(image => image.Product)
            .WithMany(product => product.Images)
            .HasForeignKey(image => image.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // NoAction obligatorio: con Cascade habria dos caminos de borrado en cascada
        // hasta ProductImages (directo desde Products y via ProductVariants) y SQL
        // Server rechaza la migracion.
        builder.HasOne(image => image.ProductVariant)
            .WithMany(variant => variant.Images)
            .HasForeignKey(image => image.ProductVariantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
