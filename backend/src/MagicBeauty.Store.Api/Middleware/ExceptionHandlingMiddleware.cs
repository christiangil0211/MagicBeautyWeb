using System.Data.Common;
using System.Net;
using System.Text.Json;

using MagicBeauty.Store.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MagicBeauty.Store.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public const string UnavailableMessage =
        "El servicio no está disponible en este momento. Inténtalo de nuevo en unos segundos.";

    public const string UnexpectedMessage =
        "Ocurrió un error inesperado. Inténtalo de nuevo más tarde.";

    /// <summary>Lo que se sugiere esperar al cliente tras un 503.</summary>
    public const int RetryAfterSeconds = 30;

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // El cliente cerró la petición (recargó o cambió de página): no es un error
            // del API y ya no hay a quién responderle.
            logger.LogDebug("Peticion cancelada por el cliente: {Method} {Path}", context.Request.Method, context.Request.Path);
        }
        catch (Exception exception)
        {
            var (statusCode, message) = Classify(exception);

            if (statusCode == HttpStatusCode.ServiceUnavailable)
            {
                // Solo tipo y numeros de error: el mensaje de SqlClient puede nombrar el servidor.
                logger.LogWarning(
                    "Dependencia no disponible ({ExceptionType}, errores SQL: {SqlErrors}) en {Method} {Path}",
                    exception.GetType().Name,
                    DatabaseAvailability.DescribeSqlErrors(exception),
                    context.Request.Method,
                    context.Request.Path);

                context.Response.Headers.RetryAfter = RetryAfterSeconds.ToString();
            }
            else
            {
                logger.LogError(exception, "Unhandled exception.");
            }

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)statusCode;

            await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
        }
    }

    /// <summary>
    /// Los mensajes de negocio (404/400) se conservan; lo técnico nunca sale del API.
    /// </summary>
    public static (HttpStatusCode StatusCode, string Message) Classify(Exception exception)
    {
        if (DatabaseAvailability.IsTemporarilyUnavailable(exception))
        {
            return (HttpStatusCode.ServiceUnavailable, UnavailableMessage);
        }

        // Errores de SQL o de EF no transitorios: su texto puede revelar el esquema.
        if (IsDataAccessFailure(exception))
        {
            return (HttpStatusCode.InternalServerError, UnexpectedMessage);
        }

        return exception switch
        {
            KeyNotFoundException => (HttpStatusCode.NotFound, exception.Message),
            ArgumentException => (HttpStatusCode.BadRequest, exception.Message),
            InvalidOperationException => (HttpStatusCode.BadRequest, exception.Message),
            _ => (HttpStatusCode.InternalServerError, UnexpectedMessage)
        };
    }

    private static bool IsDataAccessFailure(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbException or DbUpdateException)
            {
                return true;
            }
        }

        return false;
    }
}
