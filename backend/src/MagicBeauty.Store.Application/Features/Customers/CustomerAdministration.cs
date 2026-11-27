using MagicBeauty.Store.Contracts.Customers.Requests;
using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Customers;

public sealed class CustomerAdministration(ICustomerAdministrationRepository customers, TimeProvider clock)
{
    public const string StaleVersion = "El registro cambió. Actualiza la lista e inténtalo de nuevo.";

    /// <summary>La decisión y su posible cambio de acceso se guardan juntos y con ambas versiones.</summary>
    public async Task ReviewAsync(long id, ReviewRoleRequest input, int actorId, CancellationToken cancellationToken)
    {
        var note = input.Note?.Trim();
        if (input.Approve is not { } approve || note is not { Length: > 0 and <= 1000 })
            throw new ArgumentException("Indica si apruebas la solicitud y escribe una nota de hasta 1000 caracteres.");

        var request = await customers.FindRequestAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("La solicitud no existe.");
        if (request.Status != RoleRequestStatus.Pending)
            throw new InvalidOperationException("La solicitud ya fue revisada.");

        var user = request.User!;
        EnsureVersion(request.RowVersion, input.RowVersion);
        EnsureVersion(user.RowVersion, input.UserRowVersion);
        var now = clock.GetUtcNow();
        if (approve)
        {
            if (request.RequestedRole is not { Kind: RoleKind.Commercial, IsActive: true } role || !user.IsActive)
                throw new InvalidOperationException("La cuenta o el rol solicitado ya no está disponible.");

            AssignRole(user, role, CommercialRoleChangeReason.Approval, actorId, now);
        }

        request.Status = approve ? RoleRequestStatus.Approved : RoleRequestStatus.Rejected;
        request.Note = note;
        request.ReviewedByUserId = actorId;
        request.ReviewedAt = now;
        await customers.SaveAsync(cancellationToken);
    }

    public async Task ChangeRoleAsync(int id, ChangeCustomerRoleRequest input, int actorId, CancellationToken cancellationToken)
    {
        var user = await RequireCustomerAsync(id, input.RowVersion, cancellationToken);
        var code = input.RoleCode?.Trim().ToUpperInvariant();
        var role = code is { Length: > 0 and <= 50 } ? await customers.FindActiveRoleAsync(code, cancellationToken) : null;
        if (role is null) throw new ArgumentException("El rol comercial indicado no está disponible.");
        if (user.CommercialRoleId == role.Id) return;

        AssignRole(user, role, CommercialRoleChangeReason.Manual, actorId, clock.GetUtcNow());
        await customers.SaveAsync(cancellationToken);
    }

    public async Task ChangeActiveAsync(int id, ChangeCustomerActiveRequest input, int actorId, CancellationToken cancellationToken)
    {
        var user = await RequireCustomerAsync(id, input.RowVersion, cancellationToken);
        if (input.IsActive is not { } active)
            throw new ArgumentException("Indica el estado de la cuenta.");
        if (!active && (id == actorId || user.UserRoles.Any(link => link.Role?.Code == RoleCodes.Admin)))
            throw new InvalidOperationException("La gestión de clientes no puede inactivar una cuenta de administración.");
        if (user.IsActive == active) return;

        user.IsActive = active;
        user.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        user.RotateSecurityStamp();
        await customers.SaveAsync(cancellationToken);
    }

    private async Task<User> RequireCustomerAsync(int id, byte[]? version, CancellationToken cancellationToken)
    {
        var user = await customers.FindCustomerAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("La cuenta de cliente no existe.");
        EnsureVersion(user.RowVersion, version);
        return user;
    }

    private void AssignRole(User user, Role role, CommercialRoleChangeReason reason, int actorId, DateTimeOffset now)
    {
        var previous = user.CommercialRoleId;
        user.AssignCommercialRole(role);
        if (previous == role.Id)
        {
            // Una aprobación sigue siendo una decisión de acceso, aunque ya se hubiera asignado el rol.
            user.RotateSecurityStamp();
        }

        user.UpdatedAt = now.UtcDateTime;
        customers.AddHistory(new CommercialRoleHistory
        {
            UserId = user.Id, PreviousRoleId = previous, NewRoleId = role.Id, Reason = reason,
            ActorUserId = actorId, ChangedAt = now
        });
    }

    private static void EnsureVersion(byte[] current, byte[]? supplied)
    {
        if (supplied is not { Length: > 0 } || !current.AsSpan().SequenceEqual(supplied))
            throw new InvalidOperationException(StaleVersion);
    }
}
