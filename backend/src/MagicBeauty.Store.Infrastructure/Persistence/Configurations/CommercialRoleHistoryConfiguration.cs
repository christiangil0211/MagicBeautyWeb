using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class CommercialRoleHistoryConfiguration : IEntityTypeConfiguration<CommercialRoleHistory>
{
    public void Configure(EntityTypeBuilder<CommercialRoleHistory> builder)
    {
        builder.ToTable("CommercialRoleHistory");
        builder.HasIndex(entry => new { entry.UserId, entry.ChangedAt });
        builder.HasOne(entry => entry.User).WithMany()
            .HasForeignKey(entry => entry.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entry => entry.Actor).WithMany()
            .HasForeignKey(entry => entry.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entry => entry.PreviousRole).WithMany()
            .HasForeignKey(entry => entry.PreviousRoleId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entry => entry.NewRole).WithMany()
            .HasForeignKey(entry => entry.NewRoleId).OnDelete(DeleteBehavior.Restrict);
    }
}
