using System.Net.Http.Headers;
using System.Text;

using MagicBeauty.Store.Integrations.Alegra.Client;
using MagicBeauty.Store.Integrations.Alegra.Persistence;
using MagicBeauty.Store.Integrations.Alegra.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Integrations.Alegra;

/// <summary>
/// Punto de enganche de la integracion con el API. Retirarla = borrar estas dos
/// llamadas de Program.cs y la referencia al proyecto.
/// </summary>
public static class DependencyInjection
{
    public const string RoutePrefix = "/api/integrations/alegra";

    public static IServiceCollection AddAlegraIntegration(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AlegraOptions>(configuration.GetSection(AlegraOptions.SectionName));

        // Misma base que la tienda, pero esquema y migraciones propios (esquema "alegra").
        services.AddDbContext<AlegraDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql =>
            {
                sql.MigrationsHistoryTable("__EFMigrationsHistory", AlegraDbContext.Schema);
                // Azure SQL serverless se pausa: la primera consulta puede necesitar reintentos.
                sql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
            }));

        services.AddHttpClient<AlegraClient>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<AlegraOptions>>().Value;
            var baseUrl = options.BaseUrl.EndsWith('/') ? options.BaseUrl : options.BaseUrl + "/";

            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 5, 120));
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (options.IsConfigured)
            {
                var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(options.Email.Trim() + ":" + options.Token.Trim()));
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            }
        });

        services.AddScoped<IAlegraClient>(provider => provider.GetRequiredService<AlegraClient>());
        services.AddScoped<MagicBeauty.Store.Application.Features.Sales.ISalesSource, AlegraSalesSource>();
        services.AddScoped<MagicBeauty.Store.Application.Features.Customers.ICustomerImportSource, AlegraCustomerSource>();
        services.AddSingleton<AlegraSyncLock>();
        services.AddScoped<IAlegraProductSyncService, AlegraProductSyncService>();

        return services;
    }

    /// <summary>
    /// Rutas de la integracion. Devuelve el grupo para que el API le aplique su
    /// politica de autorizacion (la integracion no conoce la seguridad del API).
    /// </summary>
    public static RouteGroupBuilder MapAlegraIntegration(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(RoutePrefix).WithTags("Integración Alegra");

        // El frontend muestra el boton solo si la integracion esta lista.
        group.MapGet("/status", (IOptions<AlegraOptions> options) =>
            Results.Ok(new { enabled = options.Value.Enabled && options.Value.IsConfigured }));

        group.MapPost("/products/sync", async (
            IOptions<AlegraOptions> options,
            IAlegraProductSyncService syncService,
            CancellationToken cancellationToken) =>
        {
            if (!options.Value.Enabled || !options.Value.IsConfigured)
            {
                return Error(StatusCodes.Status404NotFound, "La integración con Alegra no está activa.");
            }

            try
            {
                return Results.Ok(await syncService.SyncAsync(cancellationToken));
            }
            catch (AlegraSyncInProgressException exception)
            {
                return Error(StatusCodes.Status409Conflict, exception.Message);
            }
            catch (AlegraException exception)
            {
                return Error(StatusCodes.Status502BadGateway, exception.Message);
            }
        });

        return group;
    }

    /// <summary>Mismo formato de error que el resto del API: <c>{ "error": "..." }</c>.</summary>
    private static IResult Error(int statusCode, string message) =>
        Results.Json(new { error = message }, statusCode: statusCode);
}
