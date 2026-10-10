using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class TraditionalCatalogConfiguration : IEntityTypeConfiguration<TraditionalCatalog>
{
    public void Configure(EntityTypeBuilder<TraditionalCatalog> builder)
    {
        builder.ToTable("TraditionalCatalogs");

        builder.HasKey(catalog => catalog.Id);

        builder.Property(catalog => catalog.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(catalog => catalog.CanvaEmbedUrl)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(catalog => catalog.CanvaShareUrl)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(catalog => catalog.CoverImageUrl)
            .HasMaxLength(500);

        builder.Property(catalog => catalog.PdfUrl)
            .HasMaxLength(500);

        builder.Property(catalog => catalog.CreatedAt)
            .IsRequired();

        builder.Property(catalog => catalog.UpdatedAt)
            .IsRequired();

        builder.HasIndex(catalog => new { catalog.IsActive, catalog.DisplayOrder });
    }
}
