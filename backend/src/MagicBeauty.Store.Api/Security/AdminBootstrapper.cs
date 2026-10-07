using MagicBeauty.Store.Application.Features.Accounts;

namespace MagicBeauty.Store.Api.Security;

/// <summary>
/// Crea el primer ADMIN cuando la base no tiene uno con ese correo. Solo corre en
/// Development y solo si se le pasan BootstrapAdmin:Email y BootstrapAdmin:Password
/// (variables de entorno de un arranque puntual o User Secrets). Nunca modifica
/// una cuenta existente ni deja credenciales en el repositorio.
/// </summary>
public static class AdminBootstrapper
{
    public static async Task BootstrapAdminAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        var email = app.Configuration["BootstrapAdmin:Email"];
        var password = app.Configuration["BootstrapAdmin:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        using var scope = app.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IAccountService>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminBootstrapper");

        var created = await accounts.EnsureAdminAsync(email, password, CancellationToken.None);

        logger.LogInformation(
            created
                ? "Administrador inicial creado para {Email}. Debe confirmar el correo en su primer inicio de sesion."
                : "Ya existe un usuario con el correo {Email}; no se modifico.",
            EmailRules.Normalize(email));
    }
}
