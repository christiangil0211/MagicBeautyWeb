using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Contracts.Brands.Responses;
using MagicBeauty.Store.Api.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Marcas en la tienda pública. Solo marcas activas y solo productos completos
/// (activos, con foto y precio al detal); los precios salen filtrados por audiencia.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/marcas")]
public sealed class PublicBrandsController(ICatalogService catalogService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PublicBrandDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await catalogService.GetBrandsAsync(cancellationToken));

    /// <summary>404 si la marca no existe o está inactiva.</summary>
    [HttpGet("{slug}")]
    [PrivateCookieResponse]
    public async Task<ActionResult<PublicBrandPageDto>> GetBySlug(
        string slug,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 48)
        => Ok(await catalogService.GetBrandPageAsync(slug, page, pageSize, cancellationToken));
}
