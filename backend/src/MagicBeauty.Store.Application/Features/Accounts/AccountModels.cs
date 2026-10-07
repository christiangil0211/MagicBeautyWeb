namespace MagicBeauty.Store.Application.Features.Accounts;

public enum LoginStatus
{
    Authenticated,
    VerificationRequired,

    /// <summary>Entro con la contrasena temporal: debe elegir la suya antes de abrir sesion.</summary>
    PasswordChangeRequired,

    /// <summary>La contrasena temporal vencio: un administrador debe enviar una nueva.</summary>
    TemporaryPasswordExpired,
    InvalidCredentials,
    LockedOut
}

/// <summary>Identidad que la capa web convierte en la cookie de sesion.</summary>
public sealed record AuthenticatedAccount(int UserId, string Email, IReadOnlyList<string> RoleCodes);

public sealed record LoginResult(LoginStatus Status, AuthenticatedAccount? Account = null, string? Email = null);

/// <summary>
/// Direcciones que van en el correo de acceso: el sitio publico de la tienda
/// (configuracion Store:PublicUrl) y el enlace directo para iniciar sesion.
/// </summary>
public sealed record AccessLinks(string? SiteUrl, string? LoginUrl);
