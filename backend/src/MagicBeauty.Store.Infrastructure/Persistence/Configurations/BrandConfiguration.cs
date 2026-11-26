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

        // Columna nullable en la base: el script de esquema la agrega sin romper el
        // código anterior y calcula el slug de las marcas existentes. El código nuevo
        // siempre lo llena; el índice único ignora los NULL.
        builder.Property(brand => brand.Slug)
            .HasMaxLength(120)
            .IsRequired(false);

        builder.HasIndex(brand => brand.Slug)
            .IsUnique()
            .HasFilter("[Slug] IS NOT NULL");

        builder.Property(brand => brand.LogoUrl)
            .HasMaxLength(500);

        builder.Property(brand => brand.Description)
            .HasMaxLength(300);

        builder.Property(brand => brand.CreatedAt)
            .IsRequired();

        builder.Property(brand => brand.UpdatedAt)
            .IsRequired();
    }
}
