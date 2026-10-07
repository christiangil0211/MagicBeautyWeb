using MagicBeauty.Store.Contracts.Users.Requests;
using MagicBeauty.Store.Contracts.Users.Responses;

namespace MagicBeauty.Store.Application.Features.Accounts;

public interface IAccountService
{
    /// <summary>
    /// Valida correo y contrasena. Si el correo aun no esta confirmado, envia un
    /// codigo y pide verificarlo antes de abrir la sesion.
    /// </summary>
    Task<LoginResult> LoginAsync(string email, string password, CancellationToken cancellationToken);

    /// <summary>Confirma el correo con el codigo y devuelve la identidad para abrir la sesion.</summary>
    Task<AuthenticatedAccount> VerifyEmailAsync(string email, string code, CancellationToken cancellationToken);

    Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Cambia la contrasena temporal por una propia y devuelve la identidad para
    /// abrir la sesion. Exige de nuevo la temporal: sin ella no hay cambio.
    /// </summary>
    Task<LoginResult> ChangeTemporaryPasswordAsync(
        string email,
        string temporaryPassword,
        string newPassword,
        CancellationToken cancellationToken);

    /// <summary>
    /// Crea un administrador con una contrasena temporal generada por el sistema
    /// y se la envia por correo. Nadie mas la conoce.
    /// </summary>
    Task<UserDto> CreateAdminAsync(
        CreateAdminUserRequest request,
        AccessLinks links,
        CancellationToken cancellationToken);

    /// <summary>Reemplaza la contrasena por una temporal nueva y la envia por correo.</summary>
    Task<UserDto> ResetAccessAsync(
        int userId,
        int requestedByUserId,
        AccessLinks links,
        CancellationToken cancellationToken);

    /// <summary>
    /// Crea el primer administrador si todavia no existe un usuario con ese correo.
    /// Nunca modifica una cuenta existente.
    /// </summary>
    Task<bool> EnsureAdminAsync(string email, string password, CancellationToken cancellationToken);
}
