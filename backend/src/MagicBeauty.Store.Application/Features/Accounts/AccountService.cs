using System.Security.Cryptography;
using System.Text;

using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.Users.Requests;
using MagicBeauty.Store.Contracts.Users.Responses;
using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Accounts;

public sealed class AccountService(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender) : IAccountService
{
    private const int MaxFailedLogins = 5;
    private const int MaxCodeAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);

    /// <summary>Evita reenviar un correo en cada clic: se reutiliza el codigo reciente.</summary>
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Hash de relleno para que un correo inexistente tarde lo mismo que una
    /// contrasena incorrecta y no se pueda deducir que cuentas existen.
    /// </summary>
    private readonly Lazy<string> dummyHash = new(() => passwordHasher.Hash(Guid.NewGuid().ToString("N")));

    public async Task<LoginResult> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var (user, failure) = await CheckCredentialsAsync(email, password, now, cancellationToken);

        if (user is null)
        {
            return new LoginResult(failure);
        }

        // Contrasena temporal: no abre sesion, solo permite elegir una propia.
        if (user.MustChangePassword)
        {
            user.UpdatedAt = now;
            await userRepository.SaveChangesAsync(cancellationToken);

            return new LoginResult(
                user.TemporaryPasswordExpiresAt <= now
                    ? LoginStatus.TemporaryPasswordExpired
                    : LoginStatus.PasswordChangeRequired,
                Email: user.Email);
        }

        // Contrasena correcta pero correo sin confirmar: el codigo demuestra que el
        // correo existe y es de quien inicia sesion.
        if (user.EmailConfirmedAt is null)
        {
            await IssueVerificationCodeAsync(user, now, cancellationToken);
            user.UpdatedAt = now;
            await userRepository.SaveChangesAsync(cancellationToken);

            return new LoginResult(LoginStatus.VerificationRequired, Email: user.Email);
        }

        user.LastLoginAt = now;
        user.UpdatedAt = now;
        await userRepository.SaveChangesAsync(cancellationToken);

        return new LoginResult(LoginStatus.Authenticated, ToAccount(user));
    }

    public async Task<AuthenticatedAccount> VerifyEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken)
    {
        const string invalidMessage = "El codigo no es valido o ya vencio. Inicia sesion de nuevo para recibir otro.";

        var normalized = EmailRules.Normalize(email);
        var user = normalized.Length == 0
            ? null
            : await userRepository.GetByEmailAsync(normalized, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new InvalidOperationException(invalidMessage);
        }

        var now = DateTime.UtcNow;
        var pending = await userRepository.GetPendingCodesAsync(user.Id, cancellationToken);
        var current = pending.FirstOrDefault();

        if (current is null || current.ExpiresAt <= now || current.Attempts >= MaxCodeAttempts)
        {
            throw new InvalidOperationException(invalidMessage);
        }

        var provided = (code ?? string.Empty).Trim();

        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(current.CodeHash),
                Convert.FromHexString(HashCode(user.Id, provided))))
        {
            current.Attempts++;
            await userRepository.SaveChangesAsync(cancellationToken);

            var remaining = MaxCodeAttempts - current.Attempts;

            throw new InvalidOperationException(remaining > 0
                ? "Codigo incorrecto. Te quedan " + remaining + " intento(s)."
                : invalidMessage);
        }

        foreach (var item in pending)
        {
            item.ConsumedAt = now;
        }

        user.EmailConfirmedAt ??= now;
        user.LastLoginAt = now;
        user.UpdatedAt = now;

        await userRepository.SaveChangesAsync(cancellationToken);

        return ToAccount(user);
    }

    public async Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken)
    {
        var users = await userRepository.GetAllAsync(cancellationToken);

        return users.Select(MapToDto).ToList();
    }

    public async Task<LoginResult> ChangeTemporaryPasswordAsync(
        string email,
        string temporaryPassword,
        string newPassword,
        CancellationToken cancellationToken)
    {
        PasswordPolicy.EnsureValid(newPassword);

        var now = DateTime.UtcNow;
        var (user, failure) = await CheckCredentialsAsync(email, temporaryPassword, now, cancellationToken);

        if (user is null)
        {
            return new LoginResult(failure);
        }

        if (!user.MustChangePassword)
        {
            throw new InvalidOperationException("Esta cuenta no tiene una contrasena temporal pendiente.");
        }

        if (user.TemporaryPasswordExpiresAt <= now)
        {
            await userRepository.SaveChangesAsync(cancellationToken);

            return new LoginResult(LoginStatus.TemporaryPasswordExpired, Email: user.Email);
        }

        if (newPassword == temporaryPassword)
        {
            throw new ArgumentException("La nueva contrasena debe ser distinta de la temporal.");
        }

        user.PasswordHash = passwordHasher.Hash(newPassword);
        user.MustChangePassword = false;
        user.TemporaryPasswordExpiresAt = null;

        // La temporal solo llega al buzon del usuario: usarla ya confirma el correo.
        user.EmailConfirmedAt ??= now;
        user.LastLoginAt = now;
        user.UpdatedAt = now;

        await userRepository.SaveChangesAsync(cancellationToken);

        return new LoginResult(LoginStatus.Authenticated, ToAccount(user));
    }

    public async Task<UserDto> CreateAdminAsync(
        CreateAdminUserRequest request,
        AccessLinks links,
        CancellationToken cancellationToken)
    {
        var temporaryPassword = TemporaryPassword.Generate();
        var user = await BuildUserAsync(request.Email, temporaryPassword, RoleCodes.Admin, cancellationToken);
        var now = user.CreatedAt;

        user.MustChangePassword = true;
        user.TemporaryPasswordExpiresAt = now.Add(TemporaryPassword.Lifetime);

        await userRepository.AddAsync(user, cancellationToken);

        // Se envia antes de guardar: si el correo falla, la cuenta no queda creada
        // con una contrasena que nadie conoce.
        await SendTemporaryPasswordAsync(user.Email, temporaryPassword, links, isNewAccount: true, cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(user);
    }

    public async Task<UserDto> ResetAccessAsync(
        int userId,
        int requestedByUserId,
        AccessLinks links,
        CancellationToken cancellationToken)
    {
        if (userId == requestedByUserId)
        {
            throw new InvalidOperationException("No puedes reenviarte un acceso a ti mismo mientras tienes la sesion abierta.");
        }

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new KeyNotFoundException("El usuario no existe.");

        if (!user.IsActive)
        {
            throw new InvalidOperationException("El usuario esta inactivo.");
        }

        var temporaryPassword = TemporaryPassword.Generate();
        var now = DateTime.UtcNow;

        // La contrasena anterior deja de servir y se levanta cualquier bloqueo.
        user.PasswordHash = passwordHasher.Hash(temporaryPassword);
        user.MustChangePassword = true;
        user.TemporaryPasswordExpiresAt = now.Add(TemporaryPassword.Lifetime);
        user.FailedLoginCount = 0;
        user.LockoutEndsAt = null;
        user.UpdatedAt = now;

        await SendTemporaryPasswordAsync(user.Email, temporaryPassword, links, isNewAccount: false, cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);

        return MapToDto(user);
    }

    public async Task<bool> EnsureAdminAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        var normalized = EmailRules.RequireValid(email);

        if (await userRepository.ExistsByEmailAsync(normalized, cancellationToken))
        {
            return false;
        }

        var user = await BuildUserAsync(normalized, password, RoleCodes.Admin, cancellationToken);

        await userRepository.AddAsync(user, cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);

        return true;
    }

    /// <summary>
    /// Comprueba correo y contrasena llevando la cuenta de intentos fallidos. Si la
    /// contrasena es correcta devuelve el usuario (con seguimiento) sin guardar.
    /// </summary>
    private async Task<(User? User, LoginStatus Failure)> CheckCredentialsAsync(
        string email,
        string password,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var normalized = EmailRules.Normalize(email);
        var user = normalized.Length == 0
            ? null
            : await userRepository.GetByEmailAsync(normalized, cancellationToken);

        if (user is null || !user.IsActive)
        {
            passwordHasher.Verify(dummyHash.Value, password ?? string.Empty);

            return (null, LoginStatus.InvalidCredentials);
        }

        if (user.LockoutEndsAt > now)
        {
            return (null, LoginStatus.LockedOut);
        }

        if (!passwordHasher.Verify(user.PasswordHash, password ?? string.Empty))
        {
            user.FailedLoginCount++;

            if (user.FailedLoginCount >= MaxFailedLogins)
            {
                user.LockoutEndsAt = now.Add(LockoutDuration);
                user.FailedLoginCount = 0;
            }

            user.UpdatedAt = now;
            await userRepository.SaveChangesAsync(cancellationToken);

            return (null, user.LockoutEndsAt > now ? LoginStatus.LockedOut : LoginStatus.InvalidCredentials);
        }

        user.FailedLoginCount = 0;
        user.LockoutEndsAt = null;

        return (user, LoginStatus.Authenticated);
    }

    private async Task SendTemporaryPasswordAsync(
        string email,
        string temporaryPassword,
        AccessLinks links,
        bool isNewAccount,
        CancellationToken cancellationToken)
    {
        var hours = (int)TemporaryPassword.Lifetime.TotalHours;

        // "https://www.magicbeautycosmetics.com/" se muestra como "www.magicbeautycosmetics.com".
        var site = string.IsNullOrWhiteSpace(links.SiteUrl)
            ? "Magic Beauty"
            : links.SiteUrl.Trim().Replace("https://", string.Empty).Replace("http://", string.Empty).TrimEnd('/');

        var intro = isNewAccount
            ? "Usted está invitado como administrador a " + site + "."
            : "Un administrador le envió un acceso nuevo a " + site + ". Su contraseña anterior ya no funciona.";

        var loginUrl = links.LoginUrl ?? links.SiteUrl;
        var where = string.IsNullOrWhiteSpace(loginUrl)
            ? "Ingrese a la tienda y pulse «Cuenta»."
            : "Ingrese aquí: " + loginUrl;

        try
        {
            await emailSender.SendAsync(
                email,
                isNewAccount
                    ? "Invitación como administrador a " + site
                    : "Su nuevo acceso a " + site,
                intro + "\n\n" +
                "Usuario: " + email + "\n" +
                "Contraseña temporal: " + temporaryPassword + "\n\n" +
                where + "\n" +
                "Al ingresar le pediremos elegir su propia contraseña. " +
                "La temporal vence en " + hours + " horas.\n\n" +
                "Si no esperaba este correo, ignórelo.",
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new InvalidOperationException(
                "No se pudo enviar el correo con la contrasena temporal. No se guardo ningun cambio.",
                exception);
        }
    }

    private async Task<User> BuildUserAsync(
        string email,
        string password,
        string roleCode,
        CancellationToken cancellationToken)
    {
        var normalized = EmailRules.RequireValid(email);
        PasswordPolicy.EnsureValid(password);

        if (await userRepository.ExistsByEmailAsync(normalized, cancellationToken))
        {
            throw new InvalidOperationException("Ya existe un usuario con ese correo.");
        }

        var role = await userRepository.GetActiveRoleByCodeAsync(roleCode, cancellationToken)
            ?? throw new InvalidOperationException("El rol " + roleCode + " no existe o esta inactivo.");

        var now = DateTime.UtcNow;

        // El correo queda sin confirmar: se confirma con el codigo en el primer inicio de sesion.
        var user = new User
        {
            Email = normalized,
            PasswordHash = passwordHasher.Hash(password),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.UserRoles.Add(new UserRole { RoleId = role.Id, Role = role });

        return user;
    }

    private async Task IssueVerificationCodeAsync(User user, DateTime now, CancellationToken cancellationToken)
    {
        var pending = await userRepository.GetPendingCodesAsync(user.Id, cancellationToken);
        var latest = pending.FirstOrDefault();

        if (latest is not null &&
            latest.ExpiresAt > now &&
            latest.Attempts < MaxCodeAttempts &&
            now - latest.CreatedAt < ResendCooldown)
        {
            return;
        }

        // Solo vale el ultimo codigo enviado.
        foreach (var item in pending)
        {
            item.ConsumedAt = now;
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        await userRepository.AddCodeAsync(
            new EmailVerificationCode
            {
                UserId = user.Id,
                CodeHash = HashCode(user.Id, code),
                ExpiresAt = now.Add(CodeLifetime),
                CreatedAt = now
            },
            cancellationToken);

        await emailSender.SendAsync(
            user.Email,
            "Tu codigo de verificacion - Magic Beauty",
            "Tu codigo para confirmar el correo en Magic Beauty es: " + code + "\n\n" +
            "Vence en " + (int)CodeLifetime.TotalMinutes + " minutos. Si no fuiste tu, ignora este mensaje.",
            cancellationToken);
    }

    private static string HashCode(int userId, string code)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(userId + ":" + code)));
    }

    private static AuthenticatedAccount ToAccount(User user)
    {
        var roles = user.UserRoles
            .Where(link => link.Role is not null && link.Role.IsActive)
            .Select(link => link.Role!.Code)
            .ToList();

        return new AuthenticatedAccount(user.Id, user.Email, roles);
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            EmailConfirmed = user.EmailConfirmedAt is not null,
            MustChangePassword = user.MustChangePassword,
            TemporaryPasswordExpiresAt = user.TemporaryPasswordExpiresAt is { } expiresAt
                ? DateTime.SpecifyKind(expiresAt, DateTimeKind.Utc)
                : null,
            IsActive = user.IsActive,
            Roles = user.UserRoles
                .Where(link => link.Role is not null)
                .Select(link => link.Role!.Code)
                .OrderBy(code => code)
                .ToList(),
            // SQL Server devuelve las fechas sin zona: se marcan como UTC para que
            // el cliente las convierta a la hora local.
            CreatedAt = DateTime.SpecifyKind(user.CreatedAt, DateTimeKind.Utc),
            LastLoginAt = user.LastLoginAt is { } lastLogin
                ? DateTime.SpecifyKind(lastLogin, DateTimeKind.Utc)
                : null
        };
    }
}
