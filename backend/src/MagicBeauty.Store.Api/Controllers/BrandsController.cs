using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common.Interfaces;
using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>Admin › Marcas: CRUD, logo y productos de cada marca (una sola marca por producto).</summary>
[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/brands")]
public sealed class BrandsController(IBrandService brandService) : ControllerBase
{
    /// <summary>Límite del logo (1 MB) más margen para el formulario.</summary>
    private const long LogoRequestLimit = 2 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BrandDto>>> GetAll([FromQuery] string? search, CancellationToken cancellationToken)
        => Ok(await brandService.GetAllAsync(search, cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BrandDto>> GetById(int id, CancellationToken cancellationToken)
        => Ok(await brandService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<BrandDto>> Create(CreateBrandRequest request, CancellationToken cancellationToken)
    {
        var brand = await brandService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = brand.Id }, brand);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BrandDto>> Update(int id, UpdateBrandRequest request, CancellationToken cancellationToken)
        => Ok(await brandService.UpdateAsync(id, request, cancellationToken));

    /// <summary>Solo sin productos; con productos responde 400 y hay que desactivarla.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await brandService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }

    [HttpPut("{id:int}/logo")]
    [RequestSizeLimit(LogoRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = LogoRequestLimit)]
    public async Task<ActionResult<BrandDto>> UploadLogo(int id, [FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        await using var content = file.OpenReadStream();

        return Ok(await brandService.UploadLogoAsync(id, content, file.Length, cancellationToken));
    }

    [HttpDelete("{id:int}/logo")]
    public async Task<ActionResult<BrandDto>> DeleteLogo(int id, CancellationToken cancellationToken)
        => Ok(await brandService.DeleteLogoAsync(id, cancellationToken));

    /// <summary>scope: all (todos), without-brand (sin marca) o in-brand (de esta marca).</summary>
    [HttpGet("{id:int}/products")]
    public async Task<ActionResult<BrandProductsPageDto>> GetProducts(
        int id,
        [FromQuery] string? scope,
        [FromQuery] string? search,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var parsed = scope switch
        {
            null or "" or "all" => BrandProductScope.All,
            "without-brand" => BrandProductScope.WithoutBrand,
            "in-brand" => BrandProductScope.InBrand,
            _ => throw new ArgumentException("Filtro inválido: all, without-brand o in-brand.")
        };

        return Ok(await brandService.GetProductsAsync(id, parsed, search, page, pageSize, cancellationToken));
    }

    /// <summary>
    /// Asigna la marca. Si algún producto ya tiene otra y no se confirmó el cambio
    /// (moveFromOtherBrands), responde 409 con esos productos y no cambia nada.
    /// </summary>
    [HttpPost("{id:int}/products")]
    public async Task<ActionResult<BrandAssignmentResultDto>> AssignProducts(
        int id,
        AssignBrandProductsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await brandService.AssignProductsAsync(id, request, cancellationToken));
        }
        catch (BrandAssignmentConflictException conflict)
        {
            return Conflict(new { error = conflict.Message, conflicts = conflict.Conflicts });
        }
    }

    /// <summary>Quita la marca de los productos: quedan sin marca.</summary>
    [HttpPost("products/remove")]
    public async Task<ActionResult<BrandAssignmentResultDto>> RemoveProducts(
        RemoveBrandProductsRequest request,
        CancellationToken cancellationToken)
        => Ok(await brandService.RemoveProductsAsync(request, cancellationToken));
}
