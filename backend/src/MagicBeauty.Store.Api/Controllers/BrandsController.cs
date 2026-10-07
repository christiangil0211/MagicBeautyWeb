using MagicBeauty.Store.Application.Features.Brands;
using MagicBeauty.Store.Contracts.Brands.Requests;
using MagicBeauty.Store.Contracts.Brands.Responses;
using MagicBeauty.Store.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/brands")]
public sealed class BrandsController(IBrandService brandService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BrandDto>>> GetAll(CancellationToken cancellationToken)
    {
        var brands = await brandService.GetAllAsync(cancellationToken);

        return Ok(brands);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BrandDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var brand = await brandService.GetByIdAsync(id, cancellationToken);

        return Ok(brand);
    }

    [HttpPost]
    public async Task<ActionResult<BrandDto>> Create(
        CreateBrandRequest request,
        CancellationToken cancellationToken)
    {
        var brand = await brandService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = brand.Id }, brand);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        UpdateBrandRequest request,
        CancellationToken cancellationToken)
    {
        await brandService.UpdateAsync(id, request, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await brandService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }
}
