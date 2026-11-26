using System.Text.RegularExpressions;

namespace MagicBeauty.Store.Api.Security;

/// <summary>
/// Origenes que pueden llamar al API desde el navegador.
/// <list type="bullet">
/// <item><c>Cors:AllowedOrigins</c>: lista exacta (produccion). Son los unicos que pueden
/// modificar datos y los unicos que se usan en los enlaces de los correos.</item>
/// <item><c>Cors:PreviewOriginPattern</c> (opcional): un patron con un solo <c>*</c> para
/// las vistas previas de Azure Static Web Apps, p. ej.
/// <c>https://mango-beach-053c1c010-*.centralus.4.azurestaticapps.net</c>. Las vistas
/// previas solo leen: CORS las deja consultar el API, pero el filtro anti-CSRF les
/// rechaza cualquier cambio (POST, PUT, DELETE), asi una rama en revision nunca
/// modifica los datos de produccion.</item>
/// </list>
/// El <c>*</c> solo cubre letras, numeros y guiones (el nombre del entorno, como
/// <c>20</c> o <c>develop</c>): nunca un punto, asi el patron no puede abrirse a otro
/// dominio ni a otro Static Web App.
/// </summary>
public sealed class CorsOrigins
{
    private readonly HashSet<string> exact;
    private readonly Regex? preview;

    public CorsOrigins(IEnumerable<string> allowedOrigins, string? previewOriginPattern)
    {
        exact = new HashSet<string>(
            allowedOrigins.Where(origin => !string.IsNullOrWhiteSpace(origin)).Select(origin => origin.Trim().TrimEnd('/')),
            StringComparer.OrdinalIgnoreCase);
        preview = string.IsNullOrWhiteSpace(previewOriginPattern) ? null : CompilePattern(previewOriginPattern.Trim());
    }

    /// <summary>Origenes de produccion: los unicos que pueden modificar datos.</summary>
    public IReadOnlySet<string> Exact => exact;

    public static CorsOrigins FromConfiguration(IConfiguration configuration) =>
        new(
            configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [],
            configuration["Cors:PreviewOriginPattern"]);

    /// <summary>CORS: produccion o una vista previa de este Static Web App.</summary>
    public bool IsAllowed(string? origin)
    {
        if (string.IsNullOrEmpty(origin))
        {
            return false;
        }

        return exact.Contains(origin) || (preview?.IsMatch(origin) ?? false);
    }

    /// <summary>
    /// Convierte el patron en una expresion anclada. Se rechazan patrones peligrosos
    /// al arrancar: sin https, con mas de un comodin o con el comodin como etiqueta
    /// completa del dominio (<c>https://*.azurestaticapps.net</c> abriria el API a
    /// cualquier sitio alojado en Azure).
    /// </summary>
    private static Regex CompilePattern(string pattern)
    {
        const string Scheme = "https://";

        if (!pattern.StartsWith(Scheme, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cors:PreviewOriginPattern debe empezar por https://.");
        }

        var host = pattern[Scheme.Length..];
        var star = host.IndexOf('*');

        if (star < 0 || host.IndexOf('*', star + 1) >= 0)
        {
            throw new InvalidOperationException("Cors:PreviewOriginPattern debe tener exactamente un *.");
        }

        if (star == 0 || host[star - 1] == '.' || host.IndexOfAny(['/', ':', '?', '#']) >= 0)
        {
            throw new InvalidOperationException(
                "Cors:PreviewOriginPattern debe fijar el nombre del sitio antes del * (p. ej. https://mi-sitio-*.region.azurestaticapps.net) y no llevar ruta ni puerto.");
        }

        var expression = "^" + Regex.Escape(Scheme + host).Replace(@"\*", "[a-z0-9-]+") + "$";

        return new Regex(expression, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(50));
    }
}
