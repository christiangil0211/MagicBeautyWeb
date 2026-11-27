using System.Security.Claims;

using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Features.Customers;
using MagicBeauty.Store.Contracts.Customers.Requests;
using MagicBeauty.Store.Contracts.Customers.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/admin/customers")]
public sealed class CustomersController(CustomerAdministration service, ICustomerAdministrationRepository customers)
    : ControllerBase
{
    [HttpGet]
    public Task<CustomerPage<CustomerAccountDto>> GetCustomers([FromQuery] CustomerListQuery query, CancellationToken cancellationToken) =>
        customers.GetCustomersAsync(query, cancellationToken);

    [HttpGet("commercial-roles")]
    public Task<IReadOnlyList<CommercialRoleDto>> GetRoles(CancellationToken cancellationToken) =>
        customers.GetRolesAsync(cancellationToken);

    [HttpGet("role-requests")]
    public Task<CustomerPage<PendingRoleRequestDto>> GetRequests(
        CancellationToken cancellationToken, [FromQuery] int page = 1, [FromQuery] int pageSize = 25) =>
        customers.GetRequestsAsync(page, pageSize, cancellationToken);

    [HttpPost("role-requests/{id:long}/decision")]
    public async Task<IActionResult> Review(long id, ReviewRoleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetActor(out var actor)) return Unauthorized();
        await service.ReviewAsync(id, request, actor, cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:int}/role")]
    public async Task<IActionResult> ChangeRole(int id, ChangeCustomerRoleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetActor(out var actor)) return Unauthorized();
        await service.ChangeRoleAsync(id, request, actor, cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:int}/active")]
    public async Task<IActionResult> ChangeActive(int id, ChangeCustomerActiveRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetActor(out var actor)) return Unauthorized();
        await service.ChangeActiveAsync(id, request, actor, cancellationToken);
        return NoContent();
    }

    private bool TryGetActor(out int actor) => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out actor);
}
