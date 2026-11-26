using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace MagicBeauty.Store.Application.Common;

/// <summary>Textos para URL y comparación de nombres, sin depender de tildes ni mayúsculas.</summary>
public static partial class Slugs
{
    public const int MaxLength = 120;

    /// <summary>"Kevin &amp; Coco" → "kevin-coco"; "PÚRPURE" → "purpure". Vacío si no queda nada.</summary>
    public static string From(string? text)
    {
        var plain = RemoveAccents(text ?? string.Empty).ToLowerInvariant();
        var slug = NonAlphanumeric().Replace(plain, "-").Trim('-');

        if (slug.Length > MaxLength)
        {
            slug = slug[..MaxLength].TrimEnd('-');
        }

        return slug;
    }

    /// <summary>
    /// Clave para saber si dos nombres son la misma marca: sin tildes, sin
    /// mayúsculas, sin espacios ni signos. "PURPURE", "Purpure" y "PÚRPURE" → "PURPURE".
    /// </summary>
    public static string NameKey(string? name) =>
        NonAlphanumeric().Replace(RemoveAccents(name ?? string.Empty).ToUpperInvariant(), string.Empty);

    /// <summary>
    /// La antigua marca comodín "Sin marca" (y variantes). No es una marca real: la
    /// tienda no la publica aunque siga en la base hasta el script de datos.
    /// </summary>
    public static bool IsNoBrandPlaceholder(string? name) => NameKey(name) == "SINMARCA";

    /// <summary>Nombre limpio: sin espacios al inicio ni al final y sin espacios repetidos.</summary>
    public static string CleanName(string? name) => Whitespace().Replace((name ?? string.Empty).Trim(), " ");

    /// <summary>Si el slug está tomado, agrega -2, -3… hasta encontrar uno libre.</summary>
    public static string MakeUnique(string slug, Func<string, bool> isTaken)
    {
        if (!isTaken(slug))
        {
            return slug;
        }

        for (var suffix = 2; ; suffix++)
        {
            var tail = "-" + suffix.ToString(CultureInfo.InvariantCulture);
            var candidate = (slug.Length + tail.Length > MaxLength ? slug[..(MaxLength - tail.Length)] : slug) + tail;

            if (!isTaken(candidate))
            {
                return candidate;
            }
        }
    }

    /// <summary>Un slug válido: minúsculas, números y guiones simples, sin guion al inicio ni al final.</summary>
    public static bool IsValid(string? slug) =>
        !string.IsNullOrEmpty(slug) && slug.Length <= MaxLength && ValidSlug().IsMatch(slug);

    private static string RemoveAccents(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    [GeneratedRegex("[^a-zA-Z0-9]+")]
    private static partial Regex NonAlphanumeric();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex ValidSlug();
}
