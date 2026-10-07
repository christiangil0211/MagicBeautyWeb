using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles");

        builder.HasKey(link => new { link.UserId, link.RoleId });

        builder.HasOne(link => link.User)
            .WithMany(user => user.UserRoles)
            .HasForeignKey(link => link.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(link => link.Role)
            .WithMany(role => role.UserRoles)
            .HasForeignKey(link => link.RoleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
