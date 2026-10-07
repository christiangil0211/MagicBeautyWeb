using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Pricing;

/// <summary>
/// Punto unico que decide que tipos de precio puede ver una audiencia. Ningun
/// otro componente (Product, servicios, controladores ni Angular) repite esta regla.
/// </summary>
public interface IPriceVisibilityPolicy
{
    /// <summary>Tipos visibles, ya ordenados para presentarse.</summary>
    Task<IReadOnlyList<PriceType>> GetVisiblePriceTypesAsync(
        PriceAudience audience,
        CancellationToken cancellationToken);
}
