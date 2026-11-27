using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles", table =>
        {
            table.HasCheckConstraint("CK_Roles_Kind", "[Kind] IN (0, 1)");
            table.HasCheckConstraint("CK_Roles_CommercialSettings",
                "([RepurchaseDays] IS NULL OR [RepurchaseDays] > 0) AND " +
                "([Kind] = 1 OR ([IsSelfRequestable] = 0 AND [RepurchaseDays] IS NULL))");
        });

        builder.HasKey(role => role.Id);
        builder.HasAlternateKey(role => new { role.Id, role.Kind });

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
            new Role { Id = 1, Code = RoleCodes.Admin, Name = "Administrador" },
            new Role { Id = 2, Code = RoleCodes.Retail, Name = "Cliente detal", Kind = RoleKind.Commercial },
            new Role
            {
                Id = 3, Code = RoleCodes.Wholesale, Name = "Cliente mayorista",
                Kind = RoleKind.Commercial, IsSelfRequestable = true, RepurchaseDays = 30
            },
            new Role
            {
                Id = 4, Code = RoleCodes.Distributor, Name = "Cliente distribuidor",
                Kind = RoleKind.Commercial, IsSelfRequestable = true
            });
    }
}
