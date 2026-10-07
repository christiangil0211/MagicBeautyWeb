using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(MagicBeautyDbContext dbContext) : IUserRepository
{
    public async Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .Include(user => user.UserRoles)
                .ThenInclude(link => link.Role)
            .FirstOrDefaultAsync(user => user.Email == normalizedEmail, cancellationToken);
    }

    public async Task<User?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        return await dbContext.Users
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

    public async Task<IReadOnlyList<EmailVerificationCode>> GetPendingCodesAsync(
        int userId,
        CancellationToken cancellationToken)
    {
        return await dbContext.EmailVerificationCodes
            .Where(code => code.UserId == userId && code.ConsumedAt == null)
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
