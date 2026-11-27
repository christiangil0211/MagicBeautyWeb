using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MagicBeauty.Store.Infrastructure.Persistence.Configurations;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");
        builder.Property(customer => customer.Source).IsRequired().HasMaxLength(64);
        builder.Property(customer => customer.ExternalId).IsRequired().HasMaxLength(128);
        builder.Property(customer => customer.DocumentNumber).IsRequired().HasMaxLength(40);
        builder.Property(customer => customer.Name).IsRequired().HasMaxLength(200);
        builder.Property(customer => customer.Email).HasMaxLength(254);
        builder.Property(customer => customer.Phone).HasMaxLength(32);
        builder.Property(customer => customer.City).HasMaxLength(120);
        builder.Property(customer => customer.BillingAddress).HasMaxLength(300);
        builder.HasIndex(customer => new { customer.Source, customer.DocumentNumber }).IsUnique();
        builder.HasIndex(customer => new { customer.Source, customer.ExternalId }).IsUnique();
        builder.HasIndex(customer => customer.DocumentNumber);
    }
}
