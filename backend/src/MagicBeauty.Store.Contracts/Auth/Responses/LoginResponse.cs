namespace MagicBeauty.Store.Contracts.Auth.Responses;

public sealed class LoginResponse
{
    /// <summary>AUTHENTICATED, VERIFICATION_REQUIRED o PASSWORD_CHANGE_REQUIRED.</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>Correo al que se envio el codigo, cuando hace falta verificarlo.</summary>
    public string? Email { get; set; }
}
