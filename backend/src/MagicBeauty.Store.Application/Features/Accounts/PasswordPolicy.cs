namespace MagicBeauty.Store.Application.Features.Accounts;

/// <summary>
/// Requisitos minimos de contrasena. El frontend muestra los mismos, pero la
/// validacion que cuenta es esta.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 128;

    public static IReadOnlyList<string> GetErrors(string? password)
    {
        var errors = new List<string>();
        var value = password ?? string.Empty;

        if (value.Length < MinLength)
        {
            errors.Add("al menos " + MinLength + " caracteres");
        }

        if (value.Length > MaxLength)
        {
            errors.Add("como maximo " + MaxLength + " caracteres");
        }

        if (!value.Any(char.IsUpper))
        {
            errors.Add("una mayuscula");
        }

        if (!value.Any(char.IsLower))
        {
            errors.Add("una minuscula");
        }

        if (!value.Any(char.IsDigit))
        {
            errors.Add("un numero");
        }

        if (value.All(char.IsLetterOrDigit))
        {
            errors.Add("un simbolo");
        }

        if (value.Any(char.IsWhiteSpace))
        {
            errors.Add("sin espacios");
        }

        return errors;
    }

    public static void EnsureValid(string? password)
    {
        var errors = GetErrors(password);

        if (errors.Count > 0)
        {
            throw new ArgumentException("La contrasena debe tener " + string.Join(", ", errors) + ".");
        }
    }
}
