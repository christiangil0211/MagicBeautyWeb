using MagicBeauty.Store.Application.Features.PriceTypes;
using MagicBeauty.Store.Contracts.PriceTypes.Responses;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Solo lectura: el catalogo se siembra por migracion. No hay administracion de
/// tipos de precio hasta que exista el requerimiento.
/// </summary>
[ApiController]
[Route("api/price-types")]
public sealed class PriceTypesController(IPriceTypeService priceTypeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PriceTypeDto>>> GetAll(CancellationToken cancellationToken)
    {
        var priceTypes = await priceTypeService.GetAllAsync(cancellationToken);

        return Ok(priceTypes);
    }
}
