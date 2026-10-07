using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Contracts.PriceTypes.Responses;

namespace MagicBeauty.Store.Application.Features.PriceTypes;

/// <summary>
/// Solo lectura: el catalogo se siembra por migracion. La administracion de
/// tipos de precio se implementara cuando exista el requerimiento.
/// </summary>
public sealed class PriceTypeService(IPriceTypeRepository priceTypeRepository) : IPriceTypeService
{
    public async Task<IReadOnlyList<PriceTypeDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var priceTypes = await priceTypeRepository.GetAllAsync(cancellationToken);

        return priceTypes
            .Select(priceType => new PriceTypeDto
            {
                Id = priceType.Id,
                Code = priceType.Code,
                Name = priceType.Name,
                IsDefault = priceType.IsDefault,
                IsPublic = priceType.IsPublic,
                DisplayOrder = priceType.DisplayOrder,
                IsActive = priceType.IsActive
            })
            .ToList();
    }
}
