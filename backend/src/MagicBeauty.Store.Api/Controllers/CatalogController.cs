using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Contracts.Products.Responses;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>
/// Cara publica del catalogo. Existe separada de ProductsController porque las
/// reglas de exposicion son distintas: aqui nunca salen precios comerciales,
/// variantes internas ni productos desactivados.
/// </summary>
[ApiController]
[Route("api/catalog")]
public sealed class CatalogController(IProductService productService) : ControllerBase
{
    [HttpGet("products/{reference}")]
    public async Task<ActionResult<ProductDetailDto>> GetByReference(
        string reference,
        CancellationToken cancellationToken)
    {
        var product = await productService.GetPublicDetailAsync(reference, cancellationToken);

        return Ok(product);
    }
}
