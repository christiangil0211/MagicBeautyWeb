using System.Security.Claims;

using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Features.Accounts;
using MagicBeauty.Store.Contracts.Auth.Requests;
using MagicBeauty.Store.Contracts.Auth.Responses;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Inicio de sesion con correo y contrasena. El primer acceso exige confirmar el
/// correo con un codigo; la sesion es una cookie HttpOnly con los roles del usuario.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/auth")]
public sealed class AuthController(
    IAccountService accountService,
    IAuthorizationService authorizationService) : ControllerBase
{
    private const string InvalidCredentialsMessage = "Correo o contrasena incorrectos.";

    [HttpPost("login")]
    [EnableRateLimiting(AuthorizationPolicies.AuthRateLimit)]
    public async Task<ActionResult<LoginResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await accountService.LoginAsync(request.Email, request.Password, cancellationToken);

        return await ToResponseAsync(result);
    }

    /// <summary>Primer ingreso: cambia la contrasena temporal por una propia y abre la sesion.</summary>
    [HttpPost("change-temporary-password")]
    [EnableRateLimiting(AuthorizationPolicies.AuthRateLimit)]
    public async Task<ActionResult<LoginResponse>> ChangeTemporaryPassword(
        ChangeTemporaryPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var result = await accountService.ChangeTemporaryPasswordAsync(
            request.Email,
            request.TemporaryPassword,
            request.NewPassword,
            cancellationToken);

        return await ToResponseAsync(result);
    }

    private async Task<ActionResult<LoginResponse>> ToResponseAsync(LoginResult result)
    {
        switch (result.Status)
        {
            case LoginStatus.Authenticated:
                await SignInAsync(result.Account!);
                return Ok(new LoginResponse { Status = "AUTHENTICATED" });

            case LoginStatus.VerificationRequired:
                return Ok(new LoginResponse { Status = "VERIFICATION_REQUIRED", Email = result.Email });

            case LoginStatus.PasswordChangeRequired:
                return Ok(new LoginResponse { Status = "PASSWORD_CHANGE_REQUIRED", Email = result.Email });

            case LoginStatus.TemporaryPasswordExpired:
                return Unauthorized(new
                {
                    error = "Tu contrasena temporal vencio. Pide a un administrador que te envie un acceso nuevo."
                });

            case LoginStatus.LockedOut:
                return StatusCode(
                    StatusCodes.Status429TooManyRequests,
                    new { error = "Demasiados intentos fallidos. Espera unos minutos e intentalo de nuevo." });

            default:
                return Unauthorized(new { error = InvalidCredentialsMessage });
        }
    }

    [HttpPost("verify-email")]
    [EnableRateLimiting(AuthorizationPolicies.AuthRateLimit)]
    public async Task<ActionResult<LoginResponse>> VerifyEmail(
        VerifyEmailRequest request,
        CancellationToken cancellationToken)
    {
        var account = await accountService.VerifyEmailAsync(request.Email, request.Code, cancellationToken);

        await SignInAsync(account);

        return Ok(new LoginResponse { Status = "AUTHENTICATED" });
    }

    [HttpGet("session")]
    public async Task<ActionResult<SessionDto>> GetSession()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(new SessionDto());
        }

        // La tienda no deduce permisos de los roles: se los pregunta a la misma
        // politica que protege los endpoints.
        var canManageStore = await authorizationService.AuthorizeAsync(
            User,
            AuthorizationPolicies.StoreAdmin);

        return Ok(new SessionDto
        {
            IsAuthenticated = true,
            DisplayName = User.Identity.Name,
            CanManageStore = canManageStore.Succeeded
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        return NoContent();
    }

    private Task SignInAsync(AuthenticatedAccount account)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, account.UserId.ToString()),
            new(ClaimTypes.Name, account.Email),
            new(ClaimTypes.Email, account.Email)
        };

        claims.AddRange(account.RoleCodes.Select(role => new Claim(ClaimTypes.Role, role)));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        return HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));
    }
}
