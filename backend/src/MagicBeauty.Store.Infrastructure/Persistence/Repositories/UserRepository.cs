using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(MagicBeautyDbContext dbContext) : IUserRepository
{
    public async Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .Include(user => user.CommercialRole)
            .Include(user => user.UserRoles)
                .ThenInclude(link => link.Role)
            .FirstOrDefaultAsync(user => user.Email == normalizedEmail, cancellationToken);
    }

    public async Task<User?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .Include(user => user.CommercialRole)
            .Include(user => user.UserRoles)
                .ThenInclude(link => link.Role)
            .FirstOrDefaultAsync(user => user.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .AnyAsync(user => user.Email == normalizedEmail, cancellationToken);
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .AsNoTracking()
            .Include(user => user.CommercialRole)
            .Include(user => user.UserRoles)
                .ThenInclude(link => link.Role)
            .OrderBy(user => user.Email)
            .ToListAsync(cancellationToken);
    }

    public async Task<Role?> GetActiveRoleByCodeAsync(string code, CancellationToken cancellationToken)
    {
        return await dbContext.Roles
            .FirstOrDefaultAsync(role => role.Code == code && role.IsActive, cancellationToken);
    }

    public async Task<IReadOnlyList<Role>> GetRequestableCommercialRolesAsync(CancellationToken cancellationToken) =>
        await dbContext.Roles.AsNoTracking()
            .Where(role => role.IsActive && role.Kind == RoleKind.Commercial && role.IsSelfRequestable)
            .OrderBy(role => role.Name).ToListAsync(cancellationToken);

    public async Task<bool> TrySaveRegistrationAsync(
        User user, PrivacyConsent consent, RoleRequest? request, CancellationToken cancellationToken)
    {
        dbContext.Users.Add(user);
        dbContext.PrivacyConsents.Add(consent);
        if (request is not null) dbContext.RoleRequests.Add(request);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is SqlException { Number: 2601 or 2627 } sql &&
            sql.Message.Contains("IX_Users_Email", StringComparison.OrdinalIgnoreCase))
        {
            // Si dos altas compiten, la transacción perdedora tampoco conserva consentimientos.
            dbContext.ChangeTracker.Clear();
            return false;
        }
    }

    public async Task<long?> FindConsentedCustomerIdAsync(
        int userId, string documentNumber, CancellationToken cancellationToken)
    {
        var matches = await dbContext.Customers.AsNoTracking()
            .Where(customer => customer.DocumentNumber == documentNumber &&
                dbContext.PrivacyConsents.Any(consent => consent.UserId == userId && consent.Accepted))
            .Select(customer => customer.Id).Take(2).ToListAsync(cancellationToken);

        return matches.Count == 1 ? matches[0] : null;
    }

    public async Task<IReadOnlyList<EmailVerificationCode>> GetPendingCodesAsync(
        int userId,
        CancellationToken cancellationToken)
    {
        return await dbContext.EmailVerificationCodes
            .Where(code => code.UserId == userId && code.Purpose == EmailCodePurpose.EmailConfirmation && code.ConsumedAt == null)
            .OrderByDescending(code => code.CreatedAt)
            .ThenByDescending(code => code.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken)
    {
        await dbContext.Users.AddAsync(user, cancellationToken);
    }

    public async Task AddCodeAsync(EmailVerificationCode code, CancellationToken cancellationToken)
    {
        await dbContext.EmailVerificationCodes.AddAsync(code, cancellationToken);
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return await dbContext.SaveChangesAsync(cancellationToken);
    }
}
