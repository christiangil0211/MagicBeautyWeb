using System.Diagnostics;

using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Contracts.Auth.Requests;
using MagicBeauty.Store.Contracts.Auth.Responses;
using MagicBeauty.Store.Domain.Common;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Customers;

public sealed class CustomerRegistrationService(IUserRepository users, IPasswordHasher passwords, TimeProvider clock)
{
    public const string PolicyVersion = "1.0";
    private static readonly TimeSpan MinimumResponseTime = TimeSpan.FromMilliseconds(500);

    public async Task<IReadOnlyList<RequestableRoleDto>> GetRequestableRolesAsync(CancellationToken cancellationToken)
    {
        var roles = await users.GetRequestableCommercialRolesAsync(cancellationToken);
        return roles.Select(role => new RequestableRoleDto(role.Code, role.Name)).ToArray();
    }

    /// <summary>Registra la cuenta y su consentimiento en una sola escritura. El ID queda en el servidor.</summary>
    public async Task<int?> RegisterAsync(RegisterCustomerRequest request, string? ipAddress, CancellationToken cancellationToken)
    {
        var started = Stopwatch.GetTimestamp();
        if (!request.PrivacyAccepted || request.PolicyVersion != PolicyVersion)
            throw new ArgumentException("Debes aceptar la versión vigente de la política de datos.");

        var email = EmailRules.RequireValid(request.Email);
        PasswordPolicy.EnsureValid(request.Password);
        var name = RequireText(request.FullName, 200, "nombre");
        var city = RequireText(request.City, 120, "ciudad");
        var phone = RequireText(request.Phone, 32, "celular");
        var digits = string.Concat(phone.Where(char.IsAsciiDigit));
        if (digits.Length is < 7 or > 15 || phone.Any(ch => !char.IsAsciiDigit(ch) && ch is not ('+' or '-' or ' ' or '(' or ')')))
            throw new ArgumentException("Escribe un número de celular válido.");

        var document = CustomerDocument.Normalize(request.DocumentNumber);
        if ((!string.IsNullOrWhiteSpace(request.DocumentNumber) || !string.IsNullOrWhiteSpace(request.RequestedRoleCode)) &&
            document is null)
            throw new ArgumentException("Escribe un número de cédula o NIT válido.");

        Role? requestedRole = null;
        if (!string.IsNullOrWhiteSpace(request.RequestedRoleCode))
        {
            requestedRole = await users.GetActiveRoleByCodeAsync(request.RequestedRoleCode.Trim().ToUpperInvariant(), cancellationToken);
            if (requestedRole is not { Kind: RoleKind.Commercial, IsSelfRequestable: true })
                throw new ArgumentException("El rol solicitado no está disponible.");
        }

        var retail = await users.GetActiveRoleByCodeAsync(RoleCodes.Retail, cancellationToken)
            ?? throw new InvalidOperationException("El registro no está disponible en este momento.");
        var now = clock.GetUtcNow();
        var user = new User
        {
            Email = email, FullName = name, Phone = phone, City = city, DocumentNumber = document,
            PasswordHash = passwords.Hash(request.Password), CreatedAt = now.UtcDateTime, UpdatedAt = now.UtcDateTime
        };
        user.AssignCommercialRole(retail);
        var consent = new PrivacyConsent
        {
            User = user, PolicyVersion = PolicyVersion, AcceptedAt = now,
            Accepted = true, MarketingOptIn = request.MarketingOptIn, IpAddress = ipAddress
        };
        var roleRequest = requestedRole is null ? null : new RoleRequest
        {
            User = user, RequestedRole = requestedRole, RequestedRoleId = requestedRole.Id,
            DocumentNumber = document!, Status = RoleRequestStatus.Pending, CreatedAt = now
        };

        var created = !await users.ExistsByEmailAsync(email, cancellationToken) &&
            await users.TrySaveRegistrationAsync(user, consent, roleRequest, cancellationToken);

        // Evita que la respuesta habitual distinga el trabajo de insertar o el rechazo del índice.
        var remaining = MinimumResponseTime - Stopwatch.GetElapsedTime(started);
        if (remaining > TimeSpan.Zero) await Task.Delay(remaining, cancellationToken);

        return created ? user.Id : null;
    }

    private static string RequireText(string? value, int maximum, string field)
    {
        var text = value?.Trim();
        return !string.IsNullOrEmpty(text) && text.Length <= maximum
            ? text
            : throw new ArgumentException($"Escribe un valor válido para {field}.");
    }
}
