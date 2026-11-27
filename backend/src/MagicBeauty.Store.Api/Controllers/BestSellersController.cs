using MagicBeauty.Store.Api.Sales;
using Microsoft.AspNetCore.Authorization;
using MagicBeauty.Store.Api.Filters;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[AllowAnonymous]
[PrivateCookieResponse]
[Route("api/catalog/best-sellers")]
public sealed class BestSellersController(BestSellers ranking) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int? categoryId, int? days, int top = 16, CancellationToken token = default)
    {
        if (days is < 1 or > 90 || top is < 1 or > 50 || categoryId is <= 0)
            return BadRequest(new { message = "El periodo debe ser de 1 a 90 días y el tope de 1 a 50 productos." });

        return Ok(await ranking.GetAsync(categoryId, days ?? ranking.DefaultDays, top, token));
    }
}
