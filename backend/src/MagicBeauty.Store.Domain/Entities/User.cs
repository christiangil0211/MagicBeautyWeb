namespace MagicBeauty.Store.Domain.Entities;

/// <summary>
/// Cuenta de acceso. El correo es el usuario y debe confirmarse con un codigo
/// antes de abrir la primera sesion. Los permisos salen de sus roles.
/// </summary>
public sealed class User
{
    public int Id { get; set; }

    /// <summary>Correo normalizado (minusculas, sin espacios). Es unico.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Hash PBKDF2 de ASP.NET Core Identity. Nunca la contrasena en claro.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Null mientras el correo no se haya confirmado con un codigo.</summary>
    public DateTime? EmailConfirmedAt { get; set; }

    /// <summary>
    /// La contrasena actual es temporal (la genero el sistema y llego por correo):
    /// no abre sesion hasta que el usuario elija la suya.
    /// </summary>
    public bool MustChangePassword { get; set; }

    /// <summary>Vencimiento de la contrasena temporal; null si la contrasena es propia.</summary>
    public DateTime? TemporaryPasswordExpiresAt { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Intentos fallidos consecutivos; se reinicia al entrar bien.</summary>
    public int FailedLoginCount { get; set; }

    /// <summary>Bloqueo temporal tras demasiados intentos fallidos.</summary>
    public DateTime? LockoutEndsAt { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();

    public ICollection<EmailVerificationCode> VerificationCodes { get; set; } = new List<EmailVerificationCode>();
}
