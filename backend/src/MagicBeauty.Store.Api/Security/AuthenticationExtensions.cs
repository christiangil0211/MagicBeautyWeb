using Microsoft.AspNetCore.Authentication.Cookies;

namespace MagicBeauty.Store.Api.Security;

public static class AuthenticationExtensions
{
    /// <summary>
    /// Configura el ticket de sesión de la tienda y valida periódicamente su identidad.
    /// </summary>
    public static IServiceCollection AddStoreAuthentication(
        this IServiceCollection services,
        IHostEnvironment environment,
        IConfiguration configuration)
    {
        services.AddOptions<StoreSessionOptions>()
            .Bind(configuration.GetSection("Auth:Session"))
            .Validate(options => options.ValidationIntervalMinutes is > 0 and <= 480 &&
                                 options.AbsoluteLifetimeHours is > 0 and <= 8760,
                "Auth:Session requiere un intervalo de 1 a 480 minutos y un máximo de 1 a 8760 horas.")
            .ValidateOnStart();

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
                options.Events.OnSigningIn = StoreSessionValidation.InitializeAsync;
                options.Events.OnValidatePrincipal = StoreSessionValidation.ValidateAsync;

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
