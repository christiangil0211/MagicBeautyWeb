using MagicBeauty.Store.Api.Middleware;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MagicBeauty.Store.Api.Filters;

/// <summary>
/// Tiempo total que puede tardar una peticion de autenticacion en el API: apertura de
/// la conexion, reintento, consultas, PBKDF2 y SMTP. Queda por debajo de los 15 s
/// que espera Angular, para que el usuario reciba la respuesta del API y no un corte.
/// </summary>
public sealed record AuthRequestBudget(TimeSpan Timeout)
{
    public static readonly AuthRequestBudget Default = new(TimeSpan.FromSeconds(13));
}

/// <summary>
/// Sustituye el CancellationToken de la accion por uno que vence con el presupuesto o
/// cuando el navegador cierra la peticion, y lo propaga hasta EF Core, SqlClient y SMTP.
/// Si vence el presupuesto, responde 503 con un mensaje generico sea cual sea la
/// excepcion con que termino la operacion cancelada.
/// </summary>
public sealed class AuthRequestBudgetFilter(
    AuthRequestBudget budget,
    ILogger<AuthRequestBudgetFilter> logger) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var clientAborted = context.HttpContext.RequestAborted;
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(clientAborted);
        limit.CancelAfter(budget.Timeout);

        foreach (var name in context.ActionArguments.Where(argument => argument.Value is CancellationToken).Select(argument => argument.Key).ToList())
        {
            context.ActionArguments[name] = limit.Token;
        }

        var executed = await next();

        if (executed.Exception is null || executed.ExceptionHandled ||
            !limit.IsCancellationRequested || clientAborted.IsCancellationRequested)
        {
            return;
        }

        logger.LogWarning(
            "Presupuesto de autenticacion agotado ({Budget} s, {ExceptionType}) en {Path}",
            budget.Timeout.TotalSeconds,
            executed.Exception.GetType().Name,
            context.HttpContext.Request.Path);

        context.HttpContext.Response.Headers.RetryAfter = ExceptionHandlingMiddleware.RetryAfterSeconds.ToString();
        executed.Result = new ObjectResult(new { error = ExceptionHandlingMiddleware.UnavailableMessage })
        {
            StatusCode = StatusCodes.Status503ServiceUnavailable
        };
        executed.ExceptionHandled = true;
    }
}

/// <summary>Aplica <see cref="AuthRequestBudgetFilter"/> a una accion o controlador.</summary>
public sealed class AuthRequestBudgetAttribute() : ServiceFilterAttribute(typeof(AuthRequestBudgetFilter));

public static class AuthRequestBudgetExtensions
{
    public static IServiceCollection AddAuthRequestBudget(this IServiceCollection services, AuthRequestBudget? budget = null)
    {
        services.AddSingleton(budget ?? AuthRequestBudget.Default);
        services.AddScoped<AuthRequestBudgetFilter>();

        return services;
    }
}
