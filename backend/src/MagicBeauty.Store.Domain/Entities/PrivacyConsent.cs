namespace MagicBeauty.Store.Domain.Entities;

/// <summary>Evidencia de la versión aceptada y de la decisión independiente sobre mercadeo.</summary>
public sealed class PrivacyConsent
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string PolicyVersion { get; set; } = string.Empty;
    public DateTimeOffset AcceptedAt { get; set; }
    public bool Accepted { get; set; }
    public bool MarketingOptIn { get; set; }
    public string? IpAddress { get; set; }
}
