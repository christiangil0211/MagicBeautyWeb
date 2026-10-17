using System.Net;
using System.Text.Json;

using MagicBeauty.Store.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public sealed class ExceptionHandlingMiddlewareTests
{
    public static TheoryData<Exception, HttpStatusCode> Classification => new()
    {
        // Negocio: se conservan codigo y mensaje.
        { new KeyNotFoundException("El producto no existe."), HttpStatusCode.NotFound },
        { new ArgumentException("La nueva contrasena debe ser distinta de la temporal."), HttpStatusCode.BadRequest },
        { new InvalidOperationException("Codigo incorrecto. Te quedan 4 intento(s)."), HttpStatusCode.BadRequest },
        // Correo de la contrasena temporal: el timeout viene envuelto en un mensaje de negocio.
        { new InvalidOperationException("No se pudo enviar el correo con la contrasena temporal. No se guardo ningun cambio.", new TimeoutException()), HttpStatusCode.BadRequest },
        // Disponibilidad: 503.
        { new RetryLimitExceededException("agotado", SqlExceptions.Create(-2)), HttpStatusCode.ServiceUnavailable },
        { SqlExceptions.Create(40613), HttpStatusCode.ServiceUnavailable },
        { new DbUpdateException("guardar", SqlExceptions.Create(40501)), HttpStatusCode.ServiceUnavailable },
        { new TimeoutException("El servidor de correo no respondio a tiempo."), HttpStatusCode.ServiceUnavailable },
        // El envoltorio de EF sin reintentos: InvalidOperationException con un SQL transitorio dentro.
        { new InvalidOperationException("An exception has been raised that is likely due to a transient failure.", SqlExceptions.Create(40613)), HttpStatusCode.ServiceUnavailable },
        // Errores de datos no transitorios: 500 generico, nunca 400 con texto de EF/SQL.
        { new InvalidOperationException("Error de EF", SqlExceptions.Create(2627)), HttpStatusCode.InternalServerError },
        { new DbUpdateException("An error occurred while saving the entity changes.", SqlExceptions.Create(547)), HttpStatusCode.InternalServerError },
        { SqlExceptions.Create(18456), HttpStatusCode.InternalServerError },
        { new NullReferenceException("Object reference not set to an instance of an object."), HttpStatusCode.InternalServerError }
    };

    [Theory]
    [MemberData(nameof(Classification))]
    public void ClassifiesByMeaningNotByType(Exception exception, HttpStatusCode expected)
    {
        Assert.Equal(expected, ExceptionHandlingMiddleware.Classify(exception).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Classification))]
    public async Task NeverLeaksTechnicalDetails(Exception exception, HttpStatusCode expected)
    {
        var (status, body, retryAfter) = await InvokeAsync(exception);

        Assert.Equal((int)expected, status);

        if (expected is HttpStatusCode.ServiceUnavailable or HttpStatusCode.InternalServerError)
        {
            Assert.DoesNotContain("Error simulado", body);
            Assert.DoesNotContain("servidor-de-prueba", body);
            Assert.DoesNotContain(exception.Message, body);
        }
        else
        {
            Assert.Equal(exception.Message, body);
        }

        Assert.Equal(expected == HttpStatusCode.ServiceUnavailable ? "30" : null, retryAfter);
    }

    [Fact]
    public async Task ServiceUnavailableMessageIsGenericSpanish()
    {
        var (_, body, _) = await InvokeAsync(new RetryLimitExceededException("agotado", SqlExceptions.Create(-2)));

        Assert.Equal(ExceptionHandlingMiddleware.UnavailableMessage, body);
    }

    [Fact]
    public async Task ClientCancellationWritesNothing()
    {
        using var aborted = new CancellationTokenSource();
        aborted.Cancel();
        var context = new DefaultHttpContext { RequestAborted = aborted.Token };
        var middleware = new ExceptionHandlingMiddleware(_ => throw new OperationCanceledException(), NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    internal static async Task<(int Status, string? Error, string? RetryAfter)> InvokeAsync(Exception exception)
    {
        return await InvokeAsync(_ => throw exception);
    }

    internal static async Task<(int Status, string? Error, string? RetryAfter)> InvokeAsync(RequestDelegate next)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new ExceptionHandlingMiddleware(next, NullLogger<ExceptionHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);
        var retryAfter = context.Response.Headers.RetryAfter.ToString();

        return (
            context.Response.StatusCode,
            json.RootElement.GetProperty("error").GetString(),
            string.IsNullOrEmpty(retryAfter) ? null : retryAfter);
    }
}
