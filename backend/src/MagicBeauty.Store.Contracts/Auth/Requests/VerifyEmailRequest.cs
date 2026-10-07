namespace MagicBeauty.Store.Contracts.Auth.Requests;

public sealed class VerifyEmailRequest
{
    public string Email { get; set; } = string.Empty;

    /// <summary>Codigo de 6 digitos recibido por correo.</summary>
    public string Code { get; set; } = string.Empty;
}
