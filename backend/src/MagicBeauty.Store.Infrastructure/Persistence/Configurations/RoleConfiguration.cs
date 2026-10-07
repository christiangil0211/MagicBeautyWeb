using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");

        builder.HasKey(role => role.Id);

        // El codigo es el que viaja en el claim de rol del usuario autenticado.
        builder.Property(role => role.Code)
            .HasMaxLength(50)
            .IsRequired();

        builder.HasIndex(role => role.Code)
            .IsUnique();

        builder.Property(role => role.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasData(
            new Role { Id = 1, Code = "ADMIN", Name = "Administrador", IsActive = true },
            new Role { Id = 2, Code = "CUSTOMER_RETAIL", Name = "Cliente detal", IsActive = true },
            new Role { Id = 3, Code = "CUSTOMER_WHOLESALE", Name = "Cliente mayorista", IsActive = true });
    }
}
