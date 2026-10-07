using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class EmailVerificationCodeConfiguration : IEntityTypeConfiguration<EmailVerificationCode>
{
    public void Configure(EntityTypeBuilder<EmailVerificationCode> builder)
    {
        builder.ToTable("EmailVerificationCodes");

        builder.HasKey(code => code.Id);

        // SHA-256 en hexadecimal: 64 caracteres.
        builder.Property(code => code.CodeHash)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(code => new { code.UserId, code.ConsumedAt });

        builder.HasOne(code => code.User)
            .WithMany(user => user.VerificationCodes)
            .HasForeignKey(code => code.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
