using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Domain.Common;
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
            .Where(user => user.UserRoles.Any(link => link.Role!.Code == RoleCodes.Admin))
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
        EmailCodePurpose purpose,
        CancellationToken cancellationToken)
    {
        return await dbContext.EmailVerificationCodes
            .Where(code => code.UserId == userId && code.Purpose == purpose && code.ConsumedAt == null)
            .OrderByDescending(code => code.CreatedAt)
            .ThenByDescending(code => code.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task RecordCodeFailureAsync(
        EmailVerificationCode code, DateTime now, int maxAttempts, CancellationToken cancellationToken)
    {
        await CurrentCode(code, now, maxAttempts)
            .ExecuteUpdateAsync(update => update.SetProperty(candidate => candidate.Attempts, candidate => candidate.Attempts + 1),
                cancellationToken);
    }

    public async Task<bool> TryCommitCodeAsync(
        EmailVerificationCode code, DateTime now, int maxAttempts, CancellationToken cancellationToken)
    {
        try
        {
            return await dbContext.Database.CreateExecutionStrategy().ExecuteAsync(async token =>
            {
                await using var transaction = await dbContext.Database.BeginTransactionAsync(token);
                var consumed = await CurrentCode(code, now, maxAttempts)
                    .ExecuteUpdateAsync(update => update.SetProperty(candidate => candidate.ConsumedAt, now), token);
                if (consumed != 1) return false;

                // Cambiar credenciales también invalida retos que se emitieron antes del cambio.
                await dbContext.EmailVerificationCodes.Where(candidate => candidate.UserId == code.UserId &&
                        candidate.ConsumedAt == null &&
                        (candidate.Purpose == code.Purpose || code.Purpose == EmailCodePurpose.PasswordReset))
                    .ExecuteUpdateAsync(update => update.SetProperty(candidate => candidate.ConsumedAt, now), token);
                await dbContext.SaveChangesAsync(false, token);
                await transaction.CommitAsync(token);
                dbContext.ChangeTracker.AcceptAllChanges();
                return true;
            }, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    private IQueryable<EmailVerificationCode> CurrentCode(EmailVerificationCode code, DateTime now, int maxAttempts) =>
        dbContext.EmailVerificationCodes.Where(candidate =>
            candidate.Id == code.Id && candidate.UserId == code.UserId && candidate.Purpose == code.Purpose &&
            candidate.ConsumedAt == null && candidate.ExpiresAt > now && candidate.Attempts < maxAttempts &&
            !dbContext.EmailVerificationCodes.Any(newer => newer.UserId == candidate.UserId &&
                newer.Purpose == candidate.Purpose &&
                (newer.CreatedAt > candidate.CreatedAt || newer.CreatedAt == candidate.CreatedAt && newer.Id > candidate.Id)));

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
