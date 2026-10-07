using System.Security.Cryptography;

namespace MagicBeauty.Store.Application.Features.Accounts;

/// <summary>
/// Contrasenas que genera el sistema para el primer ingreso. Cumplen la
/// politica minima y evitan caracteres que se confunden al copiarlas (0/O, 1/l/I).
/// </summary>
public static class TemporaryPassword
{
    public const int Length = 12;

    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(72);

    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Symbols = "!#$%*?@";
    private const string All = Upper + Lower + Digits + Symbols;

    public static string Generate()
    {
        // Uno de cada grupo garantiza la politica; el resto sale de todos los grupos.
        var chars = new List<char>
        {
            Pick(Upper),
            Pick(Lower),
            Pick(Digits),
            Pick(Symbols)
        };

        while (chars.Count < Length)
        {
            chars.Add(Pick(All));
        }

        // Mezcla para que los grupos obligatorios no queden siempre al inicio.
        for (var index = chars.Count - 1; index > 0; index--)
        {
            var swap = RandomNumberGenerator.GetInt32(index + 1);
            (chars[index], chars[swap]) = (chars[swap], chars[index]);
        }

        return new string(chars.ToArray());
    }

    private static char Pick(string source)
    {
        return source[RandomNumberGenerator.GetInt32(source.Length)];
    }
}
