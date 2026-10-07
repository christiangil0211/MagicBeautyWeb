namespace MagicBeauty.Store.Application.Features.Pricing;

/// <summary>
/// Quien consulta los precios: un visitante anonimo o un usuario autenticado con
/// sus roles. Es la unica entrada de <see cref="IPriceVisibilityPolicy"/>.
/// </summary>
public sealed class PriceAudience
{
    private PriceAudience(bool isAuthenticated, IReadOnlyCollection<string> roleCodes)
    {
        IsAuthenticated = isAuthenticated;
        RoleCodes = roleCodes;
    }

    public static PriceAudience Anonymous { get; } = new(false, []);

    public bool IsAuthenticated { get; }

    /// <summary>Codigos de rol normalizados (mayusculas, sin repetidos).</summary>
    public IReadOnlyCollection<string> RoleCodes { get; }

    public static PriceAudience Authenticated(IEnumerable<string> roleCodes)
    {
        var codes = roleCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();

        return new PriceAudience(true, codes);
    }
}
