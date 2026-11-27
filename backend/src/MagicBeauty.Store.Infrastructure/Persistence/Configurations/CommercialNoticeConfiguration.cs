using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class CommercialNoticeConfiguration : IEntityTypeConfiguration<CommercialNotice>
{
    public void Configure(EntityTypeBuilder<CommercialNotice> builder)
    {
        builder.ToTable("CommercialNotices");
        builder.Property(notice => notice.Source).HasMaxLength(64).IsRequired();
        builder.HasIndex(notice => new { notice.UserId, notice.RoleId, notice.AssignmentId, notice.PurchaseOn, notice.Kind }).IsUnique();
        builder.HasIndex(notice => new { notice.Source, notice.AttemptedAt, notice.Id });
        builder.HasOne(notice => notice.User).WithMany().HasForeignKey(notice => notice.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(notice => notice.Role).WithMany().HasForeignKey(notice => notice.RoleId).OnDelete(DeleteBehavior.Restrict);
    }
}
