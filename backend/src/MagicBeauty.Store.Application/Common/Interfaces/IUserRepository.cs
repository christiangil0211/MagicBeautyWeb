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

    /// <summary>Codigos sin consumir del usuario, del mas reciente al mas antiguo.</summary>
    Task<IReadOnlyList<EmailVerificationCode>> GetPendingCodesAsync(
        int userId,
        CancellationToken cancellationToken);

    Task AddAsync(User user, CancellationToken cancellationToken);

    Task AddCodeAsync(EmailVerificationCode code, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
