using System.Net.Mail;
using System.Text.RegularExpressions;

namespace MagicBeauty.Store.Application.Features.Accounts;

public static partial class EmailRules
{
    public const int MaxLength = 254;

    /// <summary>Usuario@dominio.tld, sin espacios. La prueba definitiva es el codigo enviado.</summary>
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")]
    private static partial Regex Pattern();

    public static string Normalize(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>Normaliza y valida; lanza ArgumentException si el formato no es valido.</summary>
    public static string RequireValid(string? email)
    {
        var normalized = Normalize(email);

        if (normalized.Length == 0 ||
            normalized.Length > MaxLength ||
            !Pattern().IsMatch(normalized) ||
            !MailAddress.TryCreate(normalized, out var parsed) ||
            parsed.Address != normalized)
        {
            throw new ArgumentException("Escribe un correo electronico valido.");
        }

        return normalized;
    }
}
