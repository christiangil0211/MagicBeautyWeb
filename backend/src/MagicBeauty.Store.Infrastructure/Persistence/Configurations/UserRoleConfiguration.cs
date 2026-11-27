using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles", table =>
            table.HasCheckConstraint("CK_UserRoles_InternalRoleKind", "[InternalRoleKind] = 0"));

        builder.HasKey(link => new { link.UserId, link.RoleId });

        builder.HasOne(link => link.User)
            .WithMany(user => user.UserRoles)
            .HasForeignKey(link => link.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property<RoleKind>("InternalRoleKind").HasDefaultValue(RoleKind.Internal);
        builder.HasOne(link => link.Role)
            .WithMany(role => role.UserRoles)
            .HasForeignKey(nameof(UserRole.RoleId), "InternalRoleKind")
            .HasPrincipalKey(role => new { role.Id, role.Kind })
            .OnDelete(DeleteBehavior.Restrict);
    }
}
