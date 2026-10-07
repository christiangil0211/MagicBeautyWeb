using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        // El COLLATE binario es necesario: la base es case-insensitive y sin el
        // [A-Z] tambien aceptaria minusculas.
        builder.ToTable("Products", table => table.HasCheckConstraint(
            "CK_Products_Reference_Format",
            "[Reference] COLLATE Latin1_General_BIN2 LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9]'"));

        builder.HasKey(product => product.Id);

        builder.Property(product => product.Reference)
            .HasMaxLength(6)
            .IsRequired();

        builder.HasIndex(product => product.Reference)
            .IsUnique();

        builder.Property(product => product.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(product => product.Description)
            .HasMaxLength(2000);

        builder.Property(product => product.CreatedAt)
            .IsRequired();

        builder.Property(product => product.UpdatedAt)
            .IsRequired();

        builder.HasOne(product => product.Brand)
            .WithMany()
            .HasForeignKey(product => product.BrandId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
