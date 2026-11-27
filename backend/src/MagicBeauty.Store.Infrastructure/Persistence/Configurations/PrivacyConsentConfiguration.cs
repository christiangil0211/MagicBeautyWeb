using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class PrivacyConsentConfiguration : IEntityTypeConfiguration<PrivacyConsent>
{
    public void Configure(EntityTypeBuilder<PrivacyConsent> builder)
    {
        builder.ToTable("PrivacyConsents", table =>
            table.HasCheckConstraint("CK_PrivacyConsents_Accepted", "[Accepted] = 1"));
        builder.Property(consent => consent.PolicyVersion).HasMaxLength(24).IsRequired();
        builder.Property(consent => consent.IpAddress).HasMaxLength(45);
        builder.HasIndex(consent => new { consent.UserId, consent.AcceptedAt });
        builder.HasOne(consent => consent.User).WithMany()
            .HasForeignKey(consent => consent.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
