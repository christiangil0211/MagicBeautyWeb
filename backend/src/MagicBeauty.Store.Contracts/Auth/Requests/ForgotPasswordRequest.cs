namespace MagicBeauty.Store.Contracts.Auth.Requests;

public sealed class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}
