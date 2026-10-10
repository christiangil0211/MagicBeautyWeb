using MagicBeauty.Store.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace MagicBeauty.Store.Infrastructure.Services;

/// <summary>
/// Sigue a mano las redirecciones: solo pide a canva.link y canva.com, de modo que
/// el API nunca sale hacia otro sitio aunque le peguen cualquier enlace.
/// </summary>
public sealed class CanvaLinkInspector(ILogger<CanvaLinkInspector> logger) : ICanvaLinkInspector
{
    private const int MaxRedirects = 3;

    private static readonly HttpClient Http = CreateClient();

    public async Task<string?> ResolveAsync(Uri shortLink, CancellationToken cancellationToken)
    {
        var current = shortLink;

        try
        {
            for (var hop = 0; hop < MaxRedirects; hop++)
            {
                if (!IsShortLinkHost(current))
                {
                    return null;
                }

                using var response = await SendAsync(current, cancellationToken);
                var location = response.Headers.Location;

                if ((int)response.StatusCode is < 300 or >= 400 || location is null)
                {
                    return null;
                }

                current = location.IsAbsoluteUri ? location : new Uri(current, location);

                if (IsCanvaHost(current))
                {
                    return current.ToString();
                }
            }
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(exception, "No se pudo resolver el enlace corto de Canva {ShortLink}.", shortLink);
        }

        return null;
    }

    /// <summary>
    /// Insertable si Canva responde la pagina directamente (sin redirigir al inicio
    /// de sesion) y no prohibe mostrarla en un iframe.
    /// </summary>
    public async Task<bool> IsEmbeddableAsync(Uri embedUrl, CancellationToken cancellationToken)
    {
        if (!IsCanvaHost(embedUrl))
        {
            return false;
        }

        try
        {
            using var response = await SendAsync(embedUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var blocksFrames = response.Headers.TryGetValues("X-Frame-Options", out var frameOptions) &&
                frameOptions.Any(value => value.Contains("deny", StringComparison.OrdinalIgnoreCase) ||
                                          value.Contains("sameorigin", StringComparison.OrdinalIgnoreCase));

            var restrictsAncestors = response.Headers.TryGetValues("Content-Security-Policy", out var policies) &&
                policies.Any(value => value.Contains("frame-ancestors", StringComparison.OrdinalIgnoreCase));

            return !blocksFrames && !restrictsAncestors;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(exception, "No se pudo comprobar si el catalogo de Canva {EmbedUrl} es insertable.", embedUrl);

            return false;
        }
    }

    private static Task<HttpResponseMessage> SendAsync(Uri url, CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);

        return Http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient(new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5)
        })
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        // Canva responde distinto a clientes sin identificar: se presenta como navegador.
        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36");

        return client;
    }

    private static bool IsShortLinkHost(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && uri.Host.Equals("canva.link", StringComparison.OrdinalIgnoreCase);

    private static bool IsCanvaHost(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps &&
        (uri.Host.Equals("www.canva.com", StringComparison.OrdinalIgnoreCase) ||
         uri.Host.Equals("canva.com", StringComparison.OrdinalIgnoreCase));
}
