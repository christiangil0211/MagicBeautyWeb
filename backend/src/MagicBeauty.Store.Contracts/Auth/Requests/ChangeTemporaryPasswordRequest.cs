namespace MagicBeauty.Store.Contracts.Auth.Requests;

public sealed class ChangeTemporaryPasswordRequest
{
    public string Email { get; set; } = string.Empty;

    /// <summary>La contrasena temporal recibida por correo.</summary>
    public string TemporaryPassword { get; set; } = string.Empty;

    public string NewPassword { get; set; } = string.Empty;
}
