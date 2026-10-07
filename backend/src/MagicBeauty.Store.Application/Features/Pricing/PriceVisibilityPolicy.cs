using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Pricing;

/// <summary>
/// La regla vive en datos, no en codigo:
/// - Anonimo: los tipos marcados como publicos (PriceType.IsPublic).
/// - Autenticado: la relacion Role -> PriceType de sus roles.
/// Un tipo nuevo no queda visible para nadie hasta que se configure.
/// </summary>
public sealed class PriceVisibilityPolicy(IPriceTypeRepository priceTypeRepository) : IPriceVisibilityPolicy
{
    public async Task<IReadOnlyList<PriceType>> GetVisiblePriceTypesAsync(
        PriceAudience audience,
        CancellationToken cancellationToken)
    {
        // Un usuario autenticado sin roles todavia no tiene condicion comercial: ve
        // lo mismo que el publico. Con roles manda exclusivamente su matriz, aunque
        // eso signifique ver menos que el publico (como un mayorista).
        if (!audience.IsAuthenticated || audience.RoleCodes.Count == 0)
        {
            return await priceTypeRepository.GetPublicAsync(cancellationToken);
        }

        return await priceTypeRepository.GetForRolesAsync(audience.RoleCodes, cancellationToken);
    }
}
