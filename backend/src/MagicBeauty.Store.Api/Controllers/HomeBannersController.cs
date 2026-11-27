using MagicBeauty.Store.Api.Security;
using MagicBeauty.Store.Application.Common;
using MagicBeauty.Store.Application.Features.HomeBanners;
using MagicBeauty.Store.Contracts.HomeBanners;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagicBeauty.Store.Api.Controllers;

/// <summary>Admin › Banners del inicio: CRUD, imagen (con copias livianas) y orden del carrusel.</summary>
[ApiController]
[Authorize(Policy = AuthorizationPolicies.StoreAdmin)]
[Route("api/home-banners")]
public sealed class HomeBannersController(IHomeBannerService bannerService) : ControllerBase
{
    /// <summary>Original (3 MB) + dos copias (1 MB cada una) + margen del formulario.</summary>
    private const long ImageRequestLimit = BannerImageRules.MaxOriginalBytes + 2 * BannerImageRules.MaxVariantBytes + 512 * 1024;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<HomeBannerDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await bannerService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HomeBannerDto>> GetById(int id, CancellationToken cancellationToken)
        => Ok(await bannerService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<HomeBannerDto>> Create(SaveHomeBannerRequest request, CancellationToken cancellationToken)
    {
        var banner = await bannerService.CreateAsync(request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = banner.Id }, banner);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<HomeBannerDto>> Update(int id, SaveHomeBannerRequest request, CancellationToken cancellationToken)
        => Ok(await bannerService.UpdateAsync(id, request, cancellationToken));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await bannerService.DeleteAsync(id, cancellationToken);

        return NoContent();
    }

    /// <summary>
    /// file: la imagen original (3:1). file768 y file1280: copias livianas opcionales
    /// que el administrador genera en el navegador.
    /// </summary>
    [HttpPut("{id:int}/image")]
    [RequestSizeLimit(ImageRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageRequestLimit)]
    public async Task<ActionResult<HomeBannerDto>> UploadImage(
        int id,
        [FromForm] IFormFile file,
        [FromForm] IFormFile? file768,
        [FromForm] IFormFile? file1280,
        CancellationToken cancellationToken)
    {
        await using var original = file.OpenReadStream();
        await using var small = file768?.OpenReadStream();
        await using var medium = file1280?.OpenReadStream();

        return Ok(await bannerService.UploadImageAsync(
            id,
            new BannerImageUpload(original, file.Length),
            small is null ? null : new BannerImageUpload(small, file768!.Length),
            medium is null ? null : new BannerImageUpload(medium, file1280!.Length),
            cancellationToken));
    }

    /// <summary>Nuevo orden del carrusel: todos los Id, del primero al último.</summary>
    [HttpPut("order")]
    public async Task<ActionResult<IReadOnlyList<HomeBannerDto>>> Reorder(ReorderHomeBannersRequest request, CancellationToken cancellationToken)
        => Ok(await bannerService.ReorderAsync(request, cancellationToken));
}
