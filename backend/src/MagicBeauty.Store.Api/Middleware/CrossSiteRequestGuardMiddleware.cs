namespace MagicBeauty.Store.Api.Middleware;

/// <summary>
/// Con la cookie SameSite=None el navegador la envia desde cualquier sitio. CORS no frena
/// las peticiones "simples" (formularios, multipart, POST sin cuerpo): este filtro rechaza
/// las que modifican datos si vienen de un origen que no esta en Cors:AllowedOrigins.
/// Las peticiones sin Origin (clientes que no son navegador) no llevan riesgo de CSRF.
/// </summary>
public sealed class CrossSiteRequestGuardMiddleware(RequestDelegate next, IReadOnlySet<string> allowedOrigins)
{
    public Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;

        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
        {
            return next(context);
        }

        var origin = context.Request.Headers.Origin.ToString();

        if (origin.Length == 0 || allowedOrigins.Contains(origin))
        {
            return next(context);
        }

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
