using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        // Sin datos sembrados: las cuentas nunca viven en el repositorio.
        builder.ToTable("Users", table =>
            table.HasCheckConstraint("CK_Users_CommercialRoleKind", "[CommercialRoleKind] = 1"));

        builder.HasKey(user => user.Id);

        builder.Property(user => user.Email)
            .HasMaxLength(254)
            .IsRequired();

        builder.HasIndex(user => user.Email)
            .IsUnique();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(user => user.SecurityStamp)
            .HasDefaultValueSql("NEWID()");

        builder.Property(user => user.CreatedAt)
            .IsRequired();

        builder.Property(user => user.UpdatedAt)
            .IsRequired();

        builder.Property(user => user.FullName).HasMaxLength(200);
        builder.Property(user => user.Phone).HasMaxLength(32);
        builder.Property(user => user.City).HasMaxLength(120);
        builder.Property(user => user.DocumentNumber).HasMaxLength(40);
        builder.Property(user => user.RowVersion).IsRowVersion();

        // La FK compuesta evita asignar un rol interno incluso desde SQL.
        builder.Property<RoleKind>("CommercialRoleKind")
            .HasSentinel(RoleKind.Internal).HasDefaultValue(RoleKind.Commercial);
        builder.HasOne(user => user.CommercialRole).WithMany()
            .HasForeignKey(nameof(User.CommercialRoleId), "CommercialRoleKind")
            .HasPrincipalKey(role => new { role.Id, role.Kind })
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(user => user.Customer).WithMany()
            .HasForeignKey(user => user.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
