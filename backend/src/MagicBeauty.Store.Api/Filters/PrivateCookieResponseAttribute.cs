namespace MagicBeauty.Store.Api.Filters;

/// <summary>Evita que un intermediario reutilice una respuesta que depende de la sesión.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class PrivateCookieResponseAttribute : Attribute;

public static class PrivateCookieResponses
{
    /// <summary>Registra primero los encabezados para aplicarlos incluso después de renovar la cookie.</summary>
    public static IApplicationBuilder UsePrivateCookieResponses(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            if (context.GetEndpoint()?.Metadata.GetMetadata<PrivateCookieResponseAttribute>() is not null)
            {
                context.Response.OnStarting(static state =>
                {
                    var headers = (IHeaderDictionary)state;
                    headers.CacheControl = "private, no-store";
                    headers.AppendCommaSeparatedValues("Vary", "Cookie");
                    return Task.CompletedTask;
                }, context.Response.Headers);
            }

            return next(context);
        });
}
