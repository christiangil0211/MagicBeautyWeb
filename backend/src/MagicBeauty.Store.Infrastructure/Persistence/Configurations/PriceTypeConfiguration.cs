using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class PriceTypeConfiguration : IEntityTypeConfiguration<PriceType>
{
    public void Configure(EntityTypeBuilder<PriceType> builder)
    {
        builder.ToTable("PriceTypes");

        builder.HasKey(priceType => priceType.Id);

        builder.Property(priceType => priceType.Code)
            .HasMaxLength(30)
            .IsRequired();

        builder.HasIndex(priceType => priceType.Code)
            .IsUnique();

        builder.Property(priceType => priceType.Name)
            .HasMaxLength(100)
            .IsRequired();

        // Solo un tipo puede ser el predeterminado.
        builder.HasIndex(priceType => priceType.IsDefault)
            .IsUnique()
            .HasFilter("[IsDefault] = 1")
            .HasDatabaseName("UX_PriceTypes_Default");

        // Catalogo sembrado por migracion: evita tener que insertarlo a mano.
        builder.HasData(
            new PriceType { Id = 1, Code = "RETAIL", Name = "Detal", IsDefault = true, IsActive = true },
            new PriceType { Id = 2, Code = "WHOLESALE", Name = "Por mayor", IsDefault = false, IsActive = true },
            new PriceType { Id = 3, Code = "DISTRIBUTOR", Name = "Distribuidor", IsDefault = false, IsActive = true });
    }
}
