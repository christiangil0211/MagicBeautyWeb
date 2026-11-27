namespace MagicBeauty.Store.Domain.Common;

public static class CustomerDocument
{
    /// <summary>Unifica separadores sin eliminar ceros, letras ni el dígito de verificación.</summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var document = string.Concat(value.Where(character =>
            !char.IsWhiteSpace(character) && character is not ('.' or '-'))).ToUpperInvariant();

        return document.Length is > 0 and <= 40 && document.All(char.IsAsciiLetterOrDigit)
            ? document
            : null;
    }
}
