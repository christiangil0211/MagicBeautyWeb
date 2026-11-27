namespace MagicBeauty.Store.Contracts.Auth.Requests;

public sealed class RegisterCustomerRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
    public string? RequestedRoleCode { get; set; }
    public bool PrivacyAccepted { get; set; }
    public bool MarketingOptIn { get; set; }
    public string PolicyVersion { get; set; } = string.Empty;
}
