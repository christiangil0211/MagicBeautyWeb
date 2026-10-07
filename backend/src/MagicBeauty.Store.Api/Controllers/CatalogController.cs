using MagicBeauty.Store.Application.Features.Catalog;
using MagicBeauty.Store.Contracts.Catalog.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Cara publica del catalogo. Existe separada de ProductsController porque las
/// reglas de exposicion son distintas: aqui nunca salen precios no autorizados
/// para quien consulta, variantes internas ni productos desactivados.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/catalog")]
public sealed class CatalogController(ICatalogService catalogService) : ControllerBase
{
    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<CatalogProductListItemDto>>> GetProducts(
        [FromQuery] int? brandId,
        [FromQuery] int? categoryId,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var products = await catalogService.GetProductsAsync(
            brandId,
            categoryId,
            search,
            cancellationToken);

        return Ok(products);
    }

    [HttpGet("products/{reference}")]
    public async Task<ActionResult<ProductDetailDto>> GetByReference(
        string reference,
        CancellationToken cancellationToken)
    {
        var product = await catalogService.GetProductDetailAsync(reference, cancellationToken);

        return Ok(product);
    }
}
