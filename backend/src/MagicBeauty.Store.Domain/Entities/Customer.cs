namespace MagicBeauty.Store.Domain.Entities;

/// <summary>Identidad de facturación importada. Solo un registro web consentido puede vincular una cuenta.</summary>
public sealed class Customer
{
    public long Id { get; set; }
    public string Source { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? City { get; set; }
    public string? BillingAddress { get; set; }
}
