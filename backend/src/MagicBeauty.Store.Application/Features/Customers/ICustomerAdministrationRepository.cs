using MagicBeauty.Store.Contracts.Customers.Requests;
using MagicBeauty.Store.Contracts.Customers.Responses;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Customers;

public interface ICustomerAdministrationRepository
{
    Task<CustomerPage<CustomerAccountDto>> GetCustomersAsync(CustomerListQuery query, CancellationToken cancellationToken);
    Task<CustomerPage<PendingRoleRequestDto>> GetRequestsAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<IReadOnlyList<CommercialRoleDto>> GetRolesAsync(CancellationToken cancellationToken);
    Task<Role?> FindActiveRoleAsync(string code, CancellationToken cancellationToken);
    Task<User?> FindCustomerAsync(int id, CancellationToken cancellationToken);
    Task<RoleRequest?> FindRequestAsync(long id, CancellationToken cancellationToken);
    void AddHistory(CommercialRoleHistory history);
    Task SaveAsync(CancellationToken cancellationToken);
}
