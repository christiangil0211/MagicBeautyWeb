using System.Net;
using System.Text.RegularExpressions;

namespace MagicBeauty.Store.Application.Features.TraditionalCatalogs;

/// <summary>
/// Valida un enlace de Canva y obtiene (a) el enlace tal como se compartio, para
/// "Abrir en Canva", y (b) la URL de insercion oficial
/// (https://www.canva.com/design/{id}[/{token}]/view?embed) para el visor. Solo
/// pasan dominios de Canva: un iframe o un enlace nunca apunta a otro sitio.
/// </summary>
/// <remarks>
/// Se aceptan enlaces de ver, presentar, insertar y tambien de edicion: decision del
/// negocio. Con un enlace de edicion el token queda publico en la tienda.
/// </remarks>
public static partial class CanvaEmbedUrl
{
    private const int MaxInputLength = 4000;

    /// <summary>Largo maximo del enlace compartido que se guarda.</summary>
    public const int MaxShareUrlLength = 1000;

    private static readonly string[] DesignActions = ["view", "watch", "edit"];

    /// <summary>
    /// Enlace que se guarda para abrir en Canva: el pegado (o el src del codigo de
    /// insercion), siempre de canva.com o canva.link.
    /// </summary>
    public static string ExtractShareUrl(string? input)
    {
        var value = Unwrap(input);

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !IsCanvaHost(uri) && !IsShortLinkHost(uri))
        {
            throw new ArgumentException("Usa un enlace de Canva (https://www.canva.com/design/... o https://canva.link/...).");
        }

        if (value.Length > MaxShareUrlLength)
        {
            throw new ArgumentException("El enlace de Canva es demasiado largo.");
        }

        return value;
    }

    /// <summary>Convierte un enlace de diseno de Canva (ver, presentar, editar o insertar) en su URL de insercion.</summary>
    public static string Normalize(string? input)
    {
        var value = Unwrap(input);

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !IsCanvaHost(uri))
        {
            throw new ArgumentException("Usa un enlace de Canva que empiece por https://www.canva.com/design/.");
        }

        var segments = uri.AbsolutePath.Trim('/').Split('/');

        // design/{id}/{accion} o design/{id}/{token}/{accion}.
        var isDesignLink = segments.Length is 3 or 4 &&
            segments[0].Equals("design", StringComparison.OrdinalIgnoreCase) &&
            DesignActions.Contains(segments[^1], StringComparer.OrdinalIgnoreCase) &&
            segments[1..^1].All(segment => Identifier().IsMatch(segment));

        if (!isDesignLink)
        {
            throw new ArgumentException("El enlace no corresponde a un diseno de Canva. Copialo desde el boton Compartir de Canva.");
        }

        var path = string.Join('/', segments[1..^1]);

        return $"https://www.canva.com/design/{path}/view?embed";
    }

    /// <summary>Enlace corto de Canva (https://canva.link/...): hay que resolverlo antes de normalizar.</summary>
    public static bool TryGetShortLink(string? input, out Uri shortLink)
    {
        shortLink = null!;

        if (!Uri.TryCreate(input?.Trim(), UriKind.Absolute, out var uri) ||
            !IsShortLinkHost(uri) ||
            uri.AbsolutePath.Trim('/').Length == 0)
        {
            return false;
        }

        shortLink = uri;

        return true;
    }

    /// <summary>Texto pegado: el enlace o, si es el codigo de insercion completo, el src del iframe.</summary>
    private static string Unwrap(string? input)
    {
        var value = input?.Trim() ?? string.Empty;

        if (value.Length == 0)
        {
            throw new ArgumentException("La URL de Canva es obligatoria.");
        }

        if (value.Length > MaxInputLength)
        {
            throw new ArgumentException("La URL de Canva es demasiado larga.");
        }

        var iframe = IframeSource().Match(value);

        return iframe.Success ? WebUtility.HtmlDecode(iframe.Groups["src"].Value).Trim() : value;
    }

    private static bool IsCanvaHost(Uri uri) =>
        IsSafe(uri) &&
        (uri.Host.Equals("www.canva.com", StringComparison.OrdinalIgnoreCase) ||
         uri.Host.Equals("canva.com", StringComparison.OrdinalIgnoreCase));

    private static bool IsShortLinkHost(Uri uri) =>
        IsSafe(uri) && uri.Host.Equals("canva.link", StringComparison.OrdinalIgnoreCase);

    private static bool IsSafe(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && uri.IsDefaultPort && uri.UserInfo.Length == 0;

    [GeneratedRegex("""<iframe\b[^>]*\bsrc\s*=\s*["'](?<src>[^"']+)["']""", RegexOptions.IgnoreCase)]
    private static partial Regex IframeSource();

    [GeneratedRegex("^[A-Za-z0-9_-]{1,100}$")]
    private static partial Regex Identifier();
}
