using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class BannerConfiguration : IEntityTypeConfiguration<Banner>
{
    public void Configure(EntityTypeBuilder<Banner> builder)
    {
        builder.ToTable("HomeBanners");

        builder.HasKey(banner => banner.Id);

        builder.Property(banner => banner.Name).HasMaxLength(60).IsRequired();
        builder.Property(banner => banner.Title).HasMaxLength(150).IsRequired();
        builder.Property(banner => banner.AltText).HasMaxLength(500).IsRequired();

        builder.Property(banner => banner.ImageUrl).HasMaxLength(500);
        builder.Property(banner => banner.ImageUrl768).HasMaxLength(500);
        builder.Property(banner => banner.ImageUrl1280).HasMaxLength(500);

        builder.Property(banner => banner.LinkUrl).HasMaxLength(300);
        builder.Property(banner => banner.LinkLabel).HasMaxLength(80);

        builder.Property(banner => banner.HotspotsJson).HasMaxLength(2000);
        builder.Property(banner => banner.MobileCtasJson).HasMaxLength(1000);

        builder.Property(banner => banner.NoteHighlight).HasMaxLength(60);
        builder.Property(banner => banner.NoteText).HasMaxLength(200);

        builder.Property(banner => banner.StartsOn).HasColumnType("date");
        builder.Property(banner => banner.EndsOn).HasColumnType("date");

        builder.Property(banner => banner.CreatedAt).IsRequired();
        builder.Property(banner => banner.UpdatedAt).IsRequired();

        // La tienda consulta los activos en orden en cada visita.
        builder.HasIndex(banner => new { banner.IsActive, banner.SortOrder });
    }
}
