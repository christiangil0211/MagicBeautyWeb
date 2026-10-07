using MagicBeauty.Store.Contracts.PriceTypes.Responses;

namespace MagicBeauty.Store.Application.Features.PriceTypes;

public interface IPriceTypeService
{
    Task<IReadOnlyList<PriceTypeDto>> GetAllAsync(CancellationToken cancellationToken);
}
