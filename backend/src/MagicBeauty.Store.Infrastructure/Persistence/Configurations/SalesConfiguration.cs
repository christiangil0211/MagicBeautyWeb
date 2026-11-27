using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class SalesConfiguration :
    IEntityTypeConfiguration<Sale>, IEntityTypeConfiguration<SaleLine>,
    IEntityTypeConfiguration<SourceItemMapping>, IEntityTypeConfiguration<ImportRun>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("Sales", "sales");
        builder.Property(x => x.Source).HasMaxLength(64).IsRequired();
        builder.Property(x => x.ExternalId).HasMaxLength(128).IsRequired();
        builder.HasIndex(x => new { x.Source, x.ExternalId }).IsUnique();
        builder.HasIndex(x => new { x.SaleDate, x.Status });
        builder.Property(x => x.PaymentForm).HasMaxLength(80);
        builder.Property(x => x.PaymentMethod).HasMaxLength(80);
        builder.Property(x => x.Subtotal).HasPrecision(19, 4);
        builder.Property(x => x.Discount).HasPrecision(19, 4);
        builder.Property(x => x.Tax).HasPrecision(19, 4);
        builder.Property(x => x.Total).HasPrecision(19, 4);
        builder.Property(x => x.TotalPaid).HasPrecision(19, 4);
        builder.Property(x => x.Balance).HasPrecision(19, 4);
        builder.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.CustomerId, x.SaleDate });
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.SaleId);
    }

    public void Configure(EntityTypeBuilder<SaleLine> builder)
    {
        builder.ToTable("SaleLines", "sales");
        builder.Property(x => x.ExternalItemId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Reference).HasMaxLength(128);
        builder.Property(x => x.Name).HasMaxLength(256);
        builder.Property(x => x.Quantity).HasPrecision(19, 6);
        builder.Property(x => x.UnitPrice).HasPrecision(19, 4);
        builder.Property(x => x.Total).HasPrecision(19, 4);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.SetNull);
    }

    public void Configure(EntityTypeBuilder<SourceItemMapping> builder)
    {
        builder.ToTable("SourceItemMappings", "sales");
        builder.HasKey(x => new { x.Source, x.ExternalItemId });
        builder.Property(x => x.Source).HasMaxLength(64);
        builder.Property(x => x.ExternalItemId).HasMaxLength(128);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }

    public void Configure(EntityTypeBuilder<ImportRun> builder)
    {
        builder.ToTable("ImportRuns", "sales");
        builder.Property(x => x.Source).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Error).HasMaxLength(512);
        builder.HasIndex(x => x.Active).IsUnique().HasFilter("[Active] = 1");
        builder.HasIndex(x => new { x.Source, x.Status, x.FinishedAt });
    }
}
