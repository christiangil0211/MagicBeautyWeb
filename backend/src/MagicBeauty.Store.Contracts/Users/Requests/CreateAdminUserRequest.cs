namespace MagicBeauty.Store.Contracts.Users.Requests;

/// <summary>
/// Solo el correo: la contrasena inicial la genera el sistema y se envia al
/// usuario, que la cambia en su primer ingreso.
/// </summary>
public sealed class CreateAdminUserRequest
{
    public string Email { get; set; } = string.Empty;
}
