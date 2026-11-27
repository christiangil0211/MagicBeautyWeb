using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Common.Interfaces;

public interface IUserRepository
{
    /// <summary>Entidad con seguimiento y sus roles, para el inicio de sesion.</summary>
    Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken);

    /// <summary>Entidad con seguimiento y sus roles.</summary>
    Task<User?> GetByIdAsync(int id, CancellationToken cancellationToken);

    Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken);

    Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken);

    Task<Role?> GetActiveRoleByCodeAsync(string code, CancellationToken cancellationToken);

    Task<IReadOnlyList<Role>> GetRequestableCommercialRolesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveRegistrationAsync(
        User user, PrivacyConsent consent, RoleRequest? request, CancellationToken cancellationToken);

    /// <summary>Vincula solo con consentimiento y con una coincidencia inequívoca entre fuentes.</summary>
    Task<long?> FindConsentedCustomerIdAsync(int userId, string documentNumber, CancellationToken cancellationToken);

    /// <summary>Codigos sin consumir del usuario, del mas reciente al mas antiguo.</summary>
    Task<IReadOnlyList<EmailVerificationCode>> GetPendingCodesAsync(
        int userId,
        EmailCodePurpose purpose,
        CancellationToken cancellationToken);

    Task RecordCodeFailureAsync(EmailVerificationCode code, DateTime now, int maxAttempts, CancellationToken cancellationToken);

    /// <summary>Consume la prueba de correo y guarda la cuenta de forma indivisible.</summary>
    Task<bool> TryCommitCodeAsync(EmailVerificationCode code, DateTime now, int maxAttempts, CancellationToken cancellationToken);

    Task AddAsync(User user, CancellationToken cancellationToken);

    Task AddCodeAsync(EmailVerificationCode code, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
