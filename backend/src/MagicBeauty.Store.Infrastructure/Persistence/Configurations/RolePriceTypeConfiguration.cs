using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class RolePriceTypeConfiguration : IEntityTypeConfiguration<RolePriceType>
{
    public void Configure(EntityTypeBuilder<RolePriceType> builder)
    {
        builder.ToTable("RolePriceTypes");

        builder.HasKey(link => new { link.RoleId, link.PriceTypeId });

        builder.HasOne(link => link.Role)
            .WithMany(role => role.RolePriceTypes)
            .HasForeignKey(link => link.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(link => link.PriceType)
            .WithMany(priceType => priceType.RolePriceTypes)
            .HasForeignKey(link => link.PriceTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Matriz inicial rol -> tipo de precio. Cambiarla es un dato, no un despliegue.
        builder.HasData(
            // ADMIN: todos los tipos configurados.
            new RolePriceType { RoleId = 1, PriceTypeId = 1 },
            new RolePriceType { RoleId = 1, PriceTypeId = 2 },
            new RolePriceType { RoleId = 1, PriceTypeId = 3 },
            // CUSTOMER_RETAIL: detal y por mayor.
            new RolePriceType { RoleId = 2, PriceTypeId = 1 },
            new RolePriceType { RoleId = 2, PriceTypeId = 2 },
            // CUSTOMER_WHOLESALE: solo por mayor.
            new RolePriceType { RoleId = 3, PriceTypeId = 2 });
    }
}
