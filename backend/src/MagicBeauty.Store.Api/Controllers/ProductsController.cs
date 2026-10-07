using MagicBeauty.Store.Application.Features.Products;
using MagicBeauty.Store.Contracts.Products.Requests;
using MagicBeauty.Store.Contracts.Products.Responses;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductListItemDto>>> GetAll(
        [FromQuery] int? brandId,
        [FromQuery] int? categoryId,
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var products = await productService.GetAllAsync(
            brandId,
            categoryId,
            isActive,
            search,
            cancellationToken);

        return Ok(products);
    }

    [HttpGet("by-reference/{reference}")]
    public async Task<ActionResult<ProductDto>> GetByReference(
        string reference,
        CancellationToken cancellationToken)
    {
        var product = await productService.GetByReferenceAsync(reference, cancellationToken);

        return Ok(product);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var product = await productService.GetByIdAsync(id, cancellationToken);

        return Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await productService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        await productService.UpdateAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await productService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }

    [HttpPut("{id:int}/categories")]
    public async Task<IActionResult> SetCategories(
        int id,
        SetProductCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        await productService.SetCategoriesAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpPut("{id:int}/prices")]
    public async Task<IActionResult> SetPrices(
        int id,
        SetProductPricesRequest request,
        CancellationToken cancellationToken)
    {
        await productService.SetPricesAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpGet("{id:int}/variants")]
    public async Task<ActionResult<IReadOnlyList<ProductVariantDto>>> GetVariants(
        int id,
        CancellationToken cancellationToken)
    {
        var variants = await productService.GetVariantsAsync(id, cancellationToken);

        return Ok(variants);
    }

    [HttpPost("{id:int}/variants")]
    public async Task<ActionResult<ProductVariantDto>> AddVariant(
        int id,
        CreateProductVariantRequest request,
        CancellationToken cancellationToken)
    {
        var variant = await productService.AddVariantAsync(id, request, cancellationToken);

        return CreatedAtAction(nameof(GetVariants), new { id }, variant);
    }

    [HttpPut("variants/{variantId:int}")]
    public async Task<IActionResult> UpdateVariant(
        int variantId,
        UpdateProductVariantRequest request,
        CancellationToken cancellationToken)
    {
        await productService.UpdateVariantAsync(variantId, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("variants/{variantId:int}")]
    public async Task<IActionResult> DeleteVariant(int variantId, CancellationToken cancellationToken)
    {
        await productService.DeleteVariantAsync(variantId, cancellationToken);

        return NoContent();
    }

    [HttpPost("variants/{variantId:int}/inventory")]
    public async Task<ActionResult<ProductVariantDto>> AdjustInventory(
        int variantId,
        AdjustInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var variant = await productService.AdjustInventoryAsync(variantId, request, cancellationToken);

        return Ok(variant);
    }

    [HttpGet("variants/{variantId:int}/movements")]
    public async Task<ActionResult<IReadOnlyList<InventoryMovementDto>>> GetMovements(
        int variantId,
        CancellationToken cancellationToken)
    {
        var movements = await productService.GetMovementsAsync(variantId, cancellationToken);

        return Ok(movements);
    }

    [HttpGet("{id:int}/images")]
    public async Task<ActionResult<IReadOnlyList<ProductImageDto>>> GetImages(
        int id,
        CancellationToken cancellationToken)
    {
        var images = await productService.GetImagesAsync(id, cancellationToken);

        return Ok(images);
    }

    [HttpPost("{id:int}/images")]
    public async Task<ActionResult<ProductImageDto>> AddImage(
        int id,
        CreateProductImageRequest request,
        CancellationToken cancellationToken)
    {
        var image = await productService.AddImageAsync(id, request, cancellationToken);

        return CreatedAtAction(nameof(GetImages), new { id }, image);
    }

    [HttpPut("images/{imageId:int}")]
    public async Task<IActionResult> UpdateImage(
        int imageId,
        UpdateProductImageRequest request,
        CancellationToken cancellationToken)
    {
        await productService.UpdateImageAsync(imageId, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("images/{imageId:int}")]
    public async Task<IActionResult> DeleteImage(int imageId, CancellationToken cancellationToken)
    {
        await productService.DeleteImageAsync(imageId, cancellationToken);

        return NoContent();
    }
}
