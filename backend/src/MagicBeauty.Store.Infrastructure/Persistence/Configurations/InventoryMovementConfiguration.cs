using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class InventoryMovementConfiguration : IEntityTypeConfiguration<InventoryMovement>
{
    public void Configure(EntityTypeBuilder<InventoryMovement> builder)
    {
        builder.ToTable("InventoryMovements");

        builder.HasKey(movement => movement.Id);

        // Texto en vez de entero para que la tabla se pueda leer directamente.
        builder.Property(movement => movement.Type)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(movement => movement.Reason)
            .HasMaxLength(300);

        builder.Property(movement => movement.CreatedAt)
            .IsRequired();

        builder.HasIndex(movement => new { movement.ProductVariantId, movement.CreatedAt });

        // Restrict: el historico de inventario no se borra en cascada.
        builder.HasOne(movement => movement.ProductVariant)
            .WithMany(variant => variant.Movements)
            .HasForeignKey(movement => movement.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
