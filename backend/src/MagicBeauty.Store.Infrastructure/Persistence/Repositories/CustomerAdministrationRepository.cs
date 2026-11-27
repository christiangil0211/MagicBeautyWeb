using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Contracts.Customers.Requests;
using MagicBeauty.Store.Contracts.Customers.Responses;
using MagicBeauty.Store.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Infrastructure.Persistence.Repositories;

public sealed class CustomerAdministrationRepository(MagicBeautyDbContext db) : ICustomerAdministrationRepository
{
    public async Task<CustomerPage<CustomerAccountDto>> GetCustomersAsync(CustomerListQuery query, CancellationToken cancellationToken)
    {
        var customers = db.Users.AsNoTracking().Where(user => user.CommercialRoleId != null);
        if (query.RoleCode?.Trim().ToUpperInvariant() is { Length: > 0 } role)
            customers = customers.Where(user => user.CommercialRole!.Code == role);
        if (query.IsActive is { } active)
            customers = customers.Where(user => user.IsActive == active);
        if (query.City?.Trim() is { Length: > 0 } city)
            customers = customers.Where(user => user.City == city);
        if (query.Search?.Trim() is { Length: > 0 } search)
            customers = customers.Where(user => user.Email.Contains(search) ||
                user.FullName != null && user.FullName.Contains(search) ||
                user.DocumentNumber != null && user.DocumentNumber.Contains(search) ||
                user.Phone != null && user.Phone.Contains(search));

        var total = await customers.CountAsync(cancellationToken);
        var (page, size) = Page(total, query.Page, query.PageSize);
        var entries = await customers.OrderBy(user => user.FullName).ThenBy(user => user.Id)
            .Skip((page - 1) * size).Take(size)
            .Select(user => new CustomerAccountDto(user.Id, user.FullName, user.Email, user.Phone, user.City,
                user.DocumentNumber, user.CommercialRole!.Code, user.CommercialRole.Name, user.IsActive,
                user.EmailConfirmedAt != null, user.RowVersion)).ToListAsync(cancellationToken);

        return new CustomerPage<CustomerAccountDto>(entries, total, page, size);
    }

    public async Task<CustomerPage<PendingRoleRequestDto>> GetRequestsAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var pending = db.RoleRequests.AsNoTracking().Where(request => request.Status == RoleRequestStatus.Pending);
        var total = await pending.CountAsync(cancellationToken);
        (page, pageSize) = Page(total, page, pageSize);
        var requests = await pending.OrderBy(request => request.CreatedAt).ThenBy(request => request.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(request => new
            {
                request.Id, request.User!.FullName, request.User.Email, request.DocumentNumber,
                request.RequestedRole!.Code, request.RequestedRole.Name, request.CreatedAt,
                request.User.CustomerId, request.RowVersion, UserRowVersion = request.User.RowVersion
            }).ToListAsync(cancellationToken);
        var ids = requests.Select(request => request.CustomerId).OfType<long>().Distinct().ToArray();
        var purchases = await db.Sales.AsNoTracking()
            .Where(sale => sale.CustomerId.HasValue && ids.Contains(sale.CustomerId.Value) &&
                (sale.Status == SaleStatus.Open || sale.Status == SaleStatus.Closed))
            .GroupBy(sale => sale.CustomerId!.Value)
            .Select(group => new
            {
                Id = group.Key, Last = group.Max(sale => sale.SaleDate), Count = group.Count(), Total = group.Sum(sale => sale.Total)
            }).ToDictionaryAsync(summary => summary.Id, cancellationToken);

        var entries = requests.Select(request =>
        {
            var purchasesForCustomer = request.CustomerId is { } customerId ? purchases.GetValueOrDefault(customerId) : null;
            return new PendingRoleRequestDto(request.Id, request.FullName, request.Email, request.DocumentNumber,
                request.Code, request.Name, request.CreatedAt, purchasesForCustomer?.Last,
                purchasesForCustomer?.Count ?? 0, purchasesForCustomer?.Total ?? 0, request.RowVersion, request.UserRowVersion);
        }).ToArray();

        return new CustomerPage<PendingRoleRequestDto>(entries, total, page, pageSize);
    }

    public async Task<IReadOnlyList<CommercialRoleDto>> GetRolesAsync(CancellationToken cancellationToken) =>
        await ActiveCommercialRoles().OrderBy(role => role.Name)
            .Select(role => new CommercialRoleDto(role.Code, role.Name)).ToListAsync(cancellationToken);

    public Task<Role?> FindActiveRoleAsync(string code, CancellationToken cancellationToken) =>
        ActiveCommercialRoles().SingleOrDefaultAsync(role => role.Code == code, cancellationToken);

    public Task<User?> FindCustomerAsync(int id, CancellationToken cancellationToken) =>
        db.Users.Include(user => user.UserRoles).ThenInclude(link => link.Role)
            .SingleOrDefaultAsync(user => user.Id == id && user.CommercialRoleId != null, cancellationToken);

    public Task<RoleRequest?> FindRequestAsync(long id, CancellationToken cancellationToken) =>
        db.RoleRequests.Include(request => request.User).Include(request => request.RequestedRole)
            .SingleOrDefaultAsync(request => request.Id == id, cancellationToken);

    public void AddHistory(CommercialRoleHistory history) => db.CommercialRoleHistory.Add(history);

    public async Task SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // EF revierte toda la escritura si cambió la cuenta o la solicitud desde su lectura.
            throw new InvalidOperationException(CustomerAdministration.StaleVersion);
        }
    }

    private IQueryable<Role> ActiveCommercialRoles() =>
        db.Roles.Where(role => role.Kind == RoleKind.Commercial && role.IsActive);

    private static (int Page, int Size) Page(int total, int page, int pageSize)
    {
        var size = Math.Clamp(pageSize, 1, 100);
        return (Math.Clamp(page, 1, Math.Max(1, (total - 1) / size + 1)), size);
    }
}
