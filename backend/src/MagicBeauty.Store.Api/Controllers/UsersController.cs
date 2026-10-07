using System.Security.Claims;

using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Contracts.Users.Requests;
using MagicBeauty.Store.Contracts.Users.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Gestion de usuarios administradores. Solo un ADMIN puede crear otro ADMIN, y
/// nunca escribe su contrasena: el sistema envia una temporal por correo.
/// </summary>
[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/admin/users")]
public sealed class UsersController(
    IAccountService accountService,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetAll(CancellationToken cancellationToken)
    {
        var users = await accountService.GetUsersAsync(cancellationToken);

        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateAdmin(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        var user = await accountService.CreateAdminAsync(request, GetAccessLinks(), cancellationToken);

        return Created("/api/admin/users/" + user.Id, user);
    }

    /// <summary>Envia una contrasena temporal nueva: sirve si olvido la suya o si la temporal vencio.</summary>
    [HttpPost("{id:int}/reset-access")]
    public async Task<ActionResult<UserDto>> ResetAccess(int id, CancellationToken cancellationToken)
    {
        var currentUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed)
            ? parsed
            : 0;

        var user = await accountService.ResetAccessAsync(id, currentUserId, GetAccessLinks(), cancellationToken);

        return Ok(user);
    }

    /// <summary>
    /// Direcciones del correo de acceso. El sitio sale de Store:PublicUrl; el
    /// enlace de ingreso, del origen de la tienda que hizo la peticion (solo si
    /// esta permitido por CORS) o, si no, del mismo sitio publico.
    /// </summary>
    private AccessLinks GetAccessLinks()
    {
        var siteUrl = configuration["Store:PublicUrl"];
        siteUrl = string.IsNullOrWhiteSpace(siteUrl) ? null : siteUrl.Trim().TrimEnd('/');

        var origin = Request.Headers.Origin.ToString();
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        var baseUrl = allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
            ? origin.TrimEnd('/')
            : siteUrl;

        return new AccessLinks(siteUrl, baseUrl is null ? null : baseUrl + "/?login=1");
    }
}
