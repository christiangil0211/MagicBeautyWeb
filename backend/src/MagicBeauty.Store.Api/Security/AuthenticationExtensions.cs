using Microsoft.AspNetCore.Authentication.Cookies;

namespace MagicBeauty.Store.Api.Security;

public static class AuthenticationExtensions
{
    /// <summary>
    /// Sesion por cookie HttpOnly. Es independiente de como se inicia la sesion: hoy
    /// solo existe el acceso local de Development; el login definitivo emitira la
    /// misma identidad (claims de rol) sin cambiar la autorizacion.
    /// </summary>
    public static IServiceCollection AddStoreAuthentication(
        this IServiceCollection services,
        IHostEnvironment environment)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "MagicBeauty.Session";
                options.Cookie.HttpOnly = true;

                if (environment.IsDevelopment())
                {
                    // La tienda (4200) y el API (5070) son el mismo sitio: Lax basta y
                    // funciona sobre http://localhost.
                    options.Cookie.SameSite = SameSiteMode.Lax;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                }
                else
                {
                    // La tienda y el API estan en sitios distintos: la cookie solo viaja con
                    // None, que exige Secure. CrossSiteRequestGuardMiddleware suple la
                    // proteccion contra CSRF que Lax daba.
                    options.Cookie.SameSite = SameSiteMode.None;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                }
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;

                // Es un API: sin redirecciones a paginas de login, solo codigos HTTP.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(AuthorizationPolicies.StoreAdmin, policy => policy
                .RequireAuthenticatedUser()
                .RequireRole(AuthorizationPolicies.AdminRole));

        return services;
    }
}
