using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class ProductPriceConfiguration : IEntityTypeConfiguration<ProductPrice>
{
    public void Configure(EntityTypeBuilder<ProductPrice> builder)
    {
        builder.ToTable("ProductPrices", table => table.HasCheckConstraint(
            "CK_ProductPrices_Amount_NotNegative",
            "[Amount] >= 0"));

        builder.HasKey(price => price.Id);

        builder.Property(price => price.Amount)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(price => price.CreatedAt)
            .IsRequired();

        builder.Property(price => price.UpdatedAt)
            .IsRequired();

        // Un solo importe por tipo de precio y producto.
        builder.HasIndex(price => new { price.ProductId, price.PriceTypeId })
            .IsUnique();

        builder.HasOne(price => price.Product)
            .WithMany(product => product.Prices)
            .HasForeignKey(price => price.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(price => price.PriceType)
            .WithMany(priceType => priceType.ProductPrices)
            .HasForeignKey(price => price.PriceTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
