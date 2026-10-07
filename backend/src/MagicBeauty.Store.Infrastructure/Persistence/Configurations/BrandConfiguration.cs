using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> builder)
    {
        builder.ToTable("Brands");

        builder.HasKey(brand => brand.Id);

        builder.Property(brand => brand.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.HasIndex(brand => brand.Name)
            .IsUnique();

        builder.Property(brand => brand.CreatedAt)
            .IsRequired();

        builder.Property(brand => brand.UpdatedAt)
            .IsRequired();
    }
}
