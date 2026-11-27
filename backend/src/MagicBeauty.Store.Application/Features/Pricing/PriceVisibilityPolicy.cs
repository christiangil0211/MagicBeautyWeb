using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Pricing;

/// <summary>
/// Ofrece precios públicos al visitante y aplica la matriz al cliente con roles.
/// La administración activa ve todos los tipos activos, incluidos los que se agreguen después.
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
