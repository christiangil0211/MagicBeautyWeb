using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class RoleRequestConfiguration : IEntityTypeConfiguration<RoleRequest>
{
    public void Configure(EntityTypeBuilder<RoleRequest> builder)
    {
        builder.ToTable("RoleRequests", table =>
            table.HasCheckConstraint("CK_RoleRequests_CommercialRoleKind", "[CommercialRoleKind] = 1"));
        builder.Property(request => request.DocumentNumber).HasMaxLength(40).IsRequired();
        builder.Property(request => request.Note).HasMaxLength(1000);
        builder.Property(request => request.RowVersion).IsRowVersion();
        builder.HasIndex(request => request.UserId).IsUnique().HasFilter("[Status] = 0");
        builder.HasIndex(request => new { request.Status, request.CreatedAt });

        builder.HasOne(request => request.User).WithMany()
            .HasForeignKey(request => request.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(request => request.ReviewedBy).WithMany()
            .HasForeignKey(request => request.ReviewedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.Property<RoleKind>("CommercialRoleKind")
            .HasSentinel(RoleKind.Internal).HasDefaultValue(RoleKind.Commercial);
        builder.HasOne(request => request.RequestedRole).WithMany()
            .HasForeignKey(nameof(RoleRequest.RequestedRoleId), "CommercialRoleKind")
            .HasPrincipalKey(role => new { role.Id, role.Kind })
            .OnDelete(DeleteBehavior.Restrict);
    }
}
